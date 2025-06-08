const express = require("express");
const { HumanMessage } = require("@langchain/core/messages");

let agentApp;
try {
  agentApp = require("./src/agent/agent").app;
  console.log("LangGraph agent loaded successfully.");
} catch (error) {
  console.error("Failed to load agent.js:", error);
  agentApp = null;
}

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.use((req, res, next) => {
  console.log(`[REQ][${new Date().toISOString()}] ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  next();
});

app.get("/", (req, res) => {
  res.send("Hello, Agent Backend is running!");
});

app.post("/chat", async (req, res, next) => {
  const userMessageContent = req.body.message;
  if (!userMessageContent) {
    const err = new Error("Message is required in the request body.");
    err.status = 400;
    return next(err);
  }
  if (!agentApp) {
    const err = new Error("Agent is not available due to loading issues.");
    err.status = 503;
    return next(err);
  }
  console.log(`[CHAT] Received user message: "${userMessageContent}"`);
  try {
    console.log(`[CHAT] Invoking agent with input:`, { messages: [new HumanMessage(userMessageContent)] });
    const agentResult = await agentApp.invoke({ messages: [new HumanMessage(userMessageContent)] });
    console.log(`[CHAT] Agent invocation completed. Result:`, JSON.stringify(agentResult, null, 2));
    if (agentResult && agentResult.messages && agentResult.messages.length > 0) {
      const lastAgentMessage = agentResult.messages[agentResult.messages.length - 1];
      const responseContent = lastAgentMessage.content || "Agent provided no textual response.";
      console.log(`[CHAT] Sending agent response: "${responseContent}"`);
      res.json({ response: responseContent });
    } else {
      const err = new Error("Agent returned an unexpected result format.");
      err.status = 500;
      return next(err);
    }
  } catch (error) {
    console.error("[CHAT] Error during agent invocation:", error);
    if (!error.status) error.status = 500;
    error.message = `Agent failed to process request: ${error.message}`;
    return next(error);
  }
});

app.use((err, req, res, next) => {
  console.error(`[ERROR][${new Date().toISOString()}] ${req.method} ${req.originalUrl} - Error: ${err.message}`);
  console.error("Stacktrace:", err.stack);
  const errorResponse = {
    error: err.message || "Internal Server Error",
    status: err.status || 500,
  };
  res.status(errorResponse.status).json(errorResponse);
});

// Conditionally start server
// This allows the app to be imported for testing without starting the server.
let server;
if (require.main === module || process.env.NODE_ENV !== 'test_direct_run') { // Modified condition
  server = app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
    console.log("Test weather: POST to /chat with JSON: { \"message\": \"What is the weather in London?\" }");
    console.log("Test user profile: POST to /chat with JSON: { \"message\": \"Show me profile for user 1\" }");
    console.log("Test no tool: POST to /chat with JSON: { \"message\": \"Hello agent\" }");
  });
}

module.exports = { app, server }; // Export server for potential teardown in tests
