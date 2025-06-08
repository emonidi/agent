const { StateGraph } = require("@langchain/langgraph");
const { HumanMessage, AIMessage, ToolMessage, SystemMessage } = require("@langchain/core/messages"); // Added SystemMessage
const { ChatOllama} = require("@langchain/ollama");
const { MultiServerMCPClient } = require("@langchain/mcp-adapters");
const { MCP_SERVERS, OLLAMA_BASE_URL, OLLAMA_MODEL } = require("../config/config.js");
const { currentWeatherTool } = require("../tools/example_tool.js");
const { fetchUserProfileTool } = require("../tools/externalProtocolTool.js");

const AGENT_LOG_PREFIX = "[AGENT]";

const agentState = {
  messages: {
    value: (x, y) => x.concat(y),
    default: () => [],
  },
};

const availableTools = {
  [currentWeatherTool.name]: currentWeatherTool,
  [fetchUserProfileTool.name]: fetchUserProfileTool,
};

const log = (level, ...args) => {
  console[level](`${AGENT_LOG_PREFIX}[${new Date().toISOString()}]`, ...args);
};

log("info", "Initial available tools:", Object.keys(availableTools).join(", "));

// IIFE to load MCP tools
(async () => {
  log("info", "Attempting to load MCP tools...");
  if (MCP_SERVERS && Object.keys(MCP_SERVERS).length > 0) {
    log("info", "MCP_SERVERS configuration found:", JSON.stringify(MCP_SERVERS));
    try {
      const client = new MultiServerMCPClient({
        mcpServers: MCP_SERVERS,
      });

      log("info", "MultiServerMCPClient initialized. Fetching tools...");
      const mcpTools = await client.getTools();
      log("info", `Fetched ${mcpTools.length} MCP tools.`);

      if (mcpTools.length > 0) {
        mcpTools.forEach(tool => {
          if (availableTools[tool.name]) {
            log("warn", `MCP Tool "${tool.name}" (from server) conflicts with an existing tool. The existing tool will be overwritten by the MCP tool.`);
          }
          availableTools[tool.name] = tool;
          log("info", `MCP Tool "${tool.name}" added to availableTools dynamically.`);
        });

        if (llm && typeof modelWithTools !== 'undefined') {
          log("info", "Re-binding tools to LLM after MCP tools have been loaded.");
          modelWithTools = llm.bindTools(Object.values(availableTools));
          log("info", "LLM tools re-bound. Current tools:", Object.keys(availableTools).join(", "));
        } else {
          log("info", "LLM or modelWithTools not yet initialized. MCP tools will be included in initial binding.");
        }
      } else {
        log("info", "No MCP tools were loaded from the configured servers.");
      }
    } catch (error) {
      log("error", "Failed to initialize MCP client or load MCP tools:", error.message);
      if (error.stack) {
        log("debug", "MCP tool loading error stack:", error.stack);
      }
    }
  } else {
    log("info", "No MCP_SERVERS configured or configuration is empty. Skipping MCP tool loading.");
  }
})();

const llm = new ChatOllama({
  model: OLLAMA_MODEL,
});
log("info", `ChatOllama model initialized with baseUrl: ${OLLAMA_BASE_URL}, model: ${OLLAMA_MODEL}`);

let modelWithTools = llm.bindTools(Object.values(availableTools));
log("info", "LLM tools bound (initial binding):", Object.keys(availableTools).join(", "));


async function getUserInputNode(state) {
  log("info", "Node:getUserInputNode - Current state messages:", JSON.stringify(state.messages, null, 2));
  return { messages: [] };
}

async function callModelNode(state) {
  const { messages } = state;

  // Construct the dynamic SystemMessage
  const toolNames = Object.keys(availableTools);
  // More specific instructions for Ollama tool usage, emphasizing JSON output.
  const systemMessageContent = `You are a helpful assistant. You have access to the following tools: ${toolNames.join(', ')}.
When you decide to use a tool, you MUST respond ONLY with a valid JSON object representing the tool call(s).
This JSON object must have a single key "tool_calls", which is an array of objects. Each object in the array must contain:
1. "name": The name of the tool to be called (string).
2. "args": An object containing the arguments for the tool (object).
3. "id": A unique identifier for this specific tool call (string, e.g., "call_abc123").

Example of a valid JSON response for a single tool call:
{
  "tool_calls": [
    {
      "name": "tool_name_here",
      "args": { "parameter1": "value1", "parameter2": "value2" },
      "id": "call_xyz789"
    }
  ]
}

Example of a valid JSON response for multiple tool calls (if supported and appropriate):
{
  "tool_calls": [
    {
      "name": "tool_one",
      "args": { "argA": "valA" },
      "id": "call_multi_001"
    },
    {
      "name": "tool_two",
      "args": { "argB": "valB" },
      "id": "call_multi_002"
    }
  ]
}

If you do not need to use a tool to answer the user's request or if the query is a general conversational statement, respond directly to the user with a natural language message. Do NOT use the JSON tool call format in this case.
Do not include any explanatory text, markdown formatting, or any other content outside of the JSON object if you are calling a tool. Your response must be ONLY the JSON object.`;

  const systemMessage = new SystemMessage({ content: systemMessageContent }); // Ensure content is passed correctly

  log("info", `Node:callModelNode - Constructed SystemMessage. Available tools: ${toolNames.join(', ')}`);
  // log("debug", "Node:callModelNode - SystemMessage content:", systemMessageContent); // Content can be long

  const messagesForLLM = [systemMessage, ...messages];
  log("info", `Node:callModelNode - Invoking LLM with ${messagesForLLM.length} messages (SystemMessage + current stack).`);
  log("debug", "Node:callModelNode - Messages for LLM (with SystemMessage prepended):", JSON.stringify(messagesForLLM.map(m => ({type: m._getType(), content: m.content, tool_calls: m.tool_calls || undefined })), null, 2));

  try {
    const aiResponse = await modelWithTools.invoke(messagesForLLM);
    log("info", "Node:callModelNode - LLM invocation successful.");
    log("debug", "Node:callModelNode - Raw AIMessage from LLM:", JSON.stringify(aiResponse, null, 2));
    return { messages: [aiResponse] };
  } catch (error) {
    log("error", "Node:callModelNode - Error invoking LLM:", error);
    // It's good practice to include the error message in the AIMessage if possible, or a generic error.
    return { messages: [new AIMessage({ content: `Sorry, I encountered an error trying to process your request. Error: ${error.message}` })] };
  }
}

async function actionNode(state) {
  const { messages } = state;
  log("info", "Node:actionNode - Received messages:", JSON.stringify(messages, null, 2));
  const lastMessage = messages[messages.length - 1];

  if (!(lastMessage instanceof AIMessage) || !lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
    log("warn", "Node:actionNode - No tool calls found in the last AIMessage or message is not an AIMessage with tool_calls.");
    return { messages: [] };
  }

  const toolCall = lastMessage.tool_calls[0]; // Processing the first tool call for simplicity
  log("info", `Node:actionNode - Processing tool_call ID: ${toolCall.id}, Name: ${toolCall.name}, Args: ${JSON.stringify(toolCall.args)}`);

  const toolToCall = availableTools[toolCall.name];

  if (!toolToCall) {
    const errorMsg = `Error: Unknown tool '${toolCall.name}' was called by the LLM. Available tools: ${Object.keys(availableTools).join(", ")}`;
    log("error", `Node:actionNode - ${errorMsg}`);
    return { messages: [new ToolMessage({ content: errorMsg, tool_call_id: toolCall.id, name: toolCall.name })] };
  }

  log("info", `Node:actionNode - Executing tool '${toolCall.name}' with args: ${JSON.stringify(toolCall.args)}`);
  let toolOutputContent;
  try {
    if (typeof toolToCall.invoke !== 'function') {
        throw new Error(`Tool "${toolCall.name}" is not a valid LangChain tool (missing invoke method).`);
    }
    toolOutputContent = await toolToCall.invoke(toolCall.args);
    log("info", `Node:actionNode - Tool '${toolCall.name}' execution successful. Output (substring): "${String(toolOutputContent).substring(0,200)}..."`);
  } catch (error) {
    log("error", `Node:actionNode - Error executing tool '${toolCall.name}':`, error);
    toolOutputContent = `Error during ${toolCall.name} execution: ${error.message}`;
  }

  const toolMessage = new ToolMessage({ content: toolOutputContent, tool_call_id: toolCall.id, name: toolCall.name });
  log("info", "Node:actionNode - Returning ToolMessage:", JSON.stringify(toolMessage, null, 2));
  return { messages: [toolMessage] };
}

async function generateResponseNode(state) {
  log("info", "Node:generateResponseNode - Final state processing:", JSON.stringify(state.messages, null, 2));
  return {};
}

const workflow = new StateGraph({ channels: agentState });
workflow.addNode("getUserInput", getUserInputNode);
workflow.addNode("callModel", callModelNode);
workflow.addNode("action", actionNode);
workflow.addNode("generateResponse", generateResponseNode);

workflow.setEntryPoint("getUserInput");
workflow.addEdge("getUserInput", "callModel");

workflow.addConditionalEdges("callModel",
  (state) => {
    const lastMessage = state.messages[state.messages.length - 1];
    if (lastMessage instanceof AIMessage && lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
      log("info", "WorkflowRouter: callModel -> action (tool call detected)");
      return "action";
    }
    log("info", "WorkflowRouter: callModel -> generateResponse (no tool call or LLM error)");
    return "generateResponse";
  },
  { action: "action", generateResponse: "generateResponse" }
);

workflow.addEdge("action", "callModel");
workflow.setFinishPoint("generateResponse");

const app = workflow.compile();
log("info", "LangGraph agent (Ollama LLM with tools) compiled successfully.");

module.exports = { app };
