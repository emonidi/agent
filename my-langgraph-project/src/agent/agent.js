const { StatefulGraph } = require("@langchain/langgraph");
const { HumanMessage, AIMessage, ToolMessage } = require("@langchain/core/messages");
const { ChatOllama } = require("@langchain/community/chat_models/ollama");
const { OLLAMA_BASE_URL, OLLAMA_MODEL } = require("../config/config.js");
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

// Instantiate the Ollama LLM
const llm = new ChatOllama({
  baseUrl: OLLAMA_BASE_URL,
  model: OLLAMA_MODEL,
  // temperature: 0,
});
log("info", `ChatOllama model initialized with baseUrl: ${OLLAMA_BASE_URL}, model: ${OLLAMA_MODEL}`);

// Bind tools to the LLM
const modelWithTools = llm.bindTools(Object.values(availableTools));
log("info", "LLM tools bound:", Object.keys(availableTools).join(", "));


async function getUserInputNode(state) {
  log("info", "Node:getUserInputNode - Current state messages:", JSON.stringify(state.messages, null, 2));
  // Assuming input messages are already in the state when the graph is invoked.
  return { messages: [] }; // No new messages to add, just pass existing state.
}

async function callModelNode(state) {
  const { messages } = state;
  log("info", `Node:callModelNode - Invoking LLM with ${messages.length} messages.`);
  log("debug", "Node:callModelNode - Current messages stack for LLM:", JSON.stringify(messages, null, 2));

  try {
    // Invoke the LLM with the current message history and bound tools
    const aiResponse = await modelWithTools.invoke(messages);
    log("info", "Node:callModelNode - LLM invocation successful.");
    log("debug", "Node:callModelNode - Raw AIMessage from LLM:", JSON.stringify(aiResponse, null, 2));

    // The aiResponse should be an AIMessage, possibly with tool_calls
    return { messages: [aiResponse] };

  } catch (error) {
    log("error", "Node:callModelNode - Error invoking LLM:", error);
    // Return an AIMessage indicating an error occurred
    return { messages: [new AIMessage({ content: `Error calling LLM: ${error.message}` })] };
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

  // Langchain typically puts tool calls in `lastMessage.tool_calls` (an array)
  // For now, process the first tool call if multiple are present.
  const toolCall = lastMessage.tool_calls[0];
  log("info", `Node:actionNode - Processing tool_call ID: ${toolCall.id}, Name: ${toolCall.name}, Args: ${JSON.stringify(toolCall.args)}`);

  const toolToCall = availableTools[toolCall.name];

  if (!toolToCall) {
    const errorMsg = `Error: Unknown tool '${toolCall.name}' was called by the LLM.`;
    log("error", `Node:actionNode - ${errorMsg}`);
    return { messages: [new ToolMessage({ content: errorMsg, tool_call_id: toolCall.id, name: toolCall.name })] };
  }

  log("info", `Node:actionNode - Executing tool '${toolCall.name}' with args: ${JSON.stringify(toolCall.args)}`);
  let toolOutputContent;
  try {
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
  // The final user-facing response is the content of the last AIMessage
  // that does not have tool_calls.
  // This node itself doesn't modify messages, just signifies the end.
  return {};
}

const workflow = new StatefulGraph({ channels: agentState });
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
