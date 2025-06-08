const { StatefulGraph } = require("@langchain/langgraph");
const { HumanMessage, AIMessage, ToolMessage } = require("@langchain/core/messages");
const { currentWeatherTool } = require("../tools/example_tool.js");
const { fetchUserProfileTool } = require("../tools/externalProtocolTool.js");

const AGENT_LOG_PREFIX = "[AGENT]"; // Simplified prefix

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

// Helper for timestamped logs
const log = (level, ...args) => {
  console[level](`${AGENT_LOG_PREFIX}[${new Date().toISOString()}]`, ...args);
};

async function getUserInputNode(state) {
  log("info", "Node:getUserInputNode - Current state messages:", JSON.stringify(state.messages, null, 2));
  return { messages: state.messages };
}

async function callModelNode(state) {
  const { messages } = state;
  log("info", "Node:callModelNode - Received messages:", JSON.stringify(messages, null, 2));
  const lastMessage = messages[messages.length - 1];
  let response;

  if (lastMessage instanceof ToolMessage) {
    log("info", `callModelNode: Tool output received for tool_call_id ${lastMessage.tool_call_id}: "${lastMessage.content.substring(0,200)}..."`);
    response = new AIMessage(`I have processed the information from ${lastMessage.name || "the tool"}: "${lastMessage.content.substring(0, 100)}..."`);
    log("info", "callModelNode: LLM decided to respond directly based on tool output.");
  } else if (lastMessage instanceof HumanMessage) {
    const humanInput = lastMessage.content.toLowerCase();
    const toolCallId = `tool_call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    if (humanInput.includes("weather")) {
      let location = "Paris";
      const weatherMatch = humanInput.match(/weather in (\w+)/i);
      if (weatherMatch && weatherMatch[1]) location = weatherMatch[1];
      log("info", `callModelNode: LLM decided to call tool '${currentWeatherTool.name}' for location '${location}' with ID '${toolCallId}'`);
      response = new AIMessage({
        content: `Thinking about the weather in ${location}...`,
        tool_calls: [{ name: currentWeatherTool.name, args: { location }, id: toolCallId }],
      });
    } else if (humanInput.includes("profile for user")) {
      let userId = "1";
      const profileMatch = humanInput.match(/profile for user (\w+)/i);
      if (profileMatch && profileMatch[1]) userId = profileMatch[1];
      log("info", `callModelNode: LLM decided to call tool '${fetchUserProfileTool.name}' for user ID '${userId}' with ID '${toolCallId}'`);
      response = new AIMessage({
        content: `Fetching profile for user ID ${userId}...`,
        tool_calls: [{ name: fetchUserProfileTool.name, args: { userId }, id: toolCallId }],
      });
    } else {
      log("info", "callModelNode: LLM decided to respond directly (no tool match).");
      response = new AIMessage("I can help with weather or user profiles. Try: 'What is the weather in London?' or 'Get profile for user 2'");
    }
  } else {
    log("warn", "callModelNode: Received unexpected message type:", lastMessage);
    response = new AIMessage("I'm a bit confused by the last message type.");
  }

  log("info", "callModelNode: Generated AIMessage:", JSON.stringify(response, null, 2));
  return { messages: [response] };
}

async function actionNode(state) {
  const { messages } = state;
  log("info", "Node:actionNode - Received messages:", JSON.stringify(messages, null, 2));

  if (!(lastMessage instanceof AIMessage) || !lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
    log("warn", "actionNode: No tool call found or last message is not AIMessage with tool_calls.");
    return { messages: [] };
  }

  const toolCall = lastMessage.tool_calls[0];
  const toolToCall = availableTools[toolCall.name];

  if (!toolToCall) {
    const errorMsg = `Error: Unknown tool ${toolCall.name} was called.`;
    log("error", `actionNode: ${errorMsg}`);
    return { messages: [new ToolMessage({ content: errorMsg, tool_call_id: toolCall.id })] };
  }

  log("info", `actionNode: Executing tool '${toolCall.name}' with args: ${JSON.stringify(toolCall.args)} and ID '${toolCall.id}'`);
  let toolOutputContent;
  try {
    toolOutputContent = await toolToCall.invoke(toolCall.args);
    log("info", `actionNode: Tool '${toolCall.name}' execution successful. Output (substring): "${String(toolOutputContent).substring(0,200)}..."`);
  } catch (error) {
    log("error", `actionNode: Error executing tool '${toolCall.name}':`, error);
    toolOutputContent = `Error executing tool ${toolCall.name}: ${error.message}`;
  }

  const toolMessage = new ToolMessage({ content: toolOutputContent, tool_call_id: toolCall.id });
  log("info", "actionNode: Returning ToolMessage:", JSON.stringify(toolMessage, null, 2));
  return { messages: [toolMessage] };
}

async function generateResponseNode(state) {
  log("info", "Node:generateResponseNode - Final state processing:", JSON.stringify(state.messages, null, 2));
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
    if (lastMessage instanceof AIMessage && lastMessage.tool_calls && lastMessage.tool_calls.length > 0) return "action";
    return "generateResponse";
  },
  { action: "action", generateResponse: "generateResponse" }
);
workflow.addEdge("action", "callModel");
workflow.setFinishPoint("generateResponse");

const app = workflow.compile();
log("info", "LangGraph agent (with enhanced logging) compiled successfully.");

module.exports = { app };
