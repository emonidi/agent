# LangGraph Coding Agent Backend

## Description

A Node.js backend for a coding agent that uses LangGraph to manage conversational flow and tool interactions. It can interact with a human user and utilize tools, including external APIs. This project integrates with a locally running Ollama instance via `ChatOllama` for language model interactions, and demonstrates tool usage with both a mock weather tool and a tool that calls the JSONPlaceholder API for user profiles.

## Prerequisites

*   Node.js (v18.x or later recommended)
*   npm (Node Package Manager)
*   Ollama installed and running locally. Download from [https://ollama.com](https://ollama.com).
*   The language model specified in `src/config/config.js` (default: `llama3`) must be downloaded in your Ollama instance. You can pull it using:
    ```bash
    ollama pull llama3
    # Or: ollama pull <your_configured_model_name>
    ```

## Installation

1.  Clone the repository:
    ```bash
    # Replace <repository-url> with the actual URL if applicable
    # git clone <repository-url>
    # cd my-langgraph-project
    # For the current environment, the project is already in /app/my-langgraph-project
    cd /app/my-langgraph-project
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```

## Configuration

*   Primary application configuration can be found in `src/config/config.js`.
*   **Ollama Configuration**:
    *   `OLLAMA_BASE_URL`: The base URL for your local Ollama server (default: `"http://localhost:11434"`).
    *   `OLLAMA_MODEL`: The name of the model to use from your Ollama instance (default: `"llama3"`). Ensure this model is available in Ollama.
*   **External API Tool Configuration**:
    *   `MODEL_CONTEXT_API_BASE_URL`: Currently set to `https://jsonplaceholder.typicode.com` for the example `fetchUserProfileTool`.
*   The project now uses `ChatOllama` to connect to your local Ollama instance, replacing the previous mock LLM setup.

## Running the Application

To start the server:
```bash
# Ensure your Ollama server is running and the configured model (e.g., llama3) is available before starting the application.
# npm start
# (This command would start the server, typically on http://localhost:3000)
```
The server will typically run on `http://localhost:3000`.

## Running Tests

To run the test suite (Jest):
```bash
# npm test
# (This command would execute all tests defined in the project)
```
Note: Integration tests currently mock the `ChatOllama` interactions, so they do not require a live Ollama server to run.

## API Endpoints

### POST `/chat`

*   **Description**: Sends a message to the agent and receives a response. The agent can reply directly or use tools to gather information before replying, using a live Ollama instance.
*   **Request Body**:
    ```json
    {
      "message": "Your message to the agent"
    }
    ```
*   **Example Success Response (Simple Chat - no tool triggered)**:
    *(Response will vary based on the Ollama model's output)*
    ```json
    {
      "response": "Hello! How can I assist you today with weather or user profiles?"
    }
    ```
*   **Example Success Response (Tool Usage - Weather)**:
    After sending `{"message": "What is the weather in Paris?"}`
    *(Response will vary based on the Ollama model's output after processing tool results)*
    ```json
    {
      "response": "I have processed the information: \"The weather in Paris is sunny and warm....\""
    }
    ```
*   **Example Success Response (Tool Usage - User Profile)**:
    After sending `{"message": "Show me profile for user 1"}`
    *(Response will vary based on the Ollama model's output after processing tool results)*
    ```json
    {
      "response": "I have processed the information: \"User Profile for ID 1: Name - Leanne Graham, Email - Sincere@april.biz, City - Gwenborough...\""
    }
    ```
*   **Example Error Response (Bad Request - Missing Message)**:
    ```json
    {
      "error": "Message is required in the request body.",
      "status": 400
    }
    ```
*   **Example Error Response (Server Error - Agent Fails / Ollama Unavailable)**:
    ```json
    {
      "error": "Agent failed to process request: Error calling LLM: [specific Ollama error message]",
      "status": 500
    }
    ```

## Example Usage with cURL

Note: Responses will vary based on the Ollama model used.

### Simple Chat (No Tool)
```bash
curl -X POST -H "Content-Type: application/json" -d '{"message": "Hello agent"}' http://localhost:3000/chat
```

### Get Weather (triggers currentWeatherTool)
```bash
curl -X POST -H "Content-Type: application/json" -d '{"message": "What is the weather like in London?"}' http://localhost:3000/chat
```

### Get User Profile (triggers fetchUserProfileTool)
```bash
curl -X POST -H "Content-Type: application/json" -d '{"message": "Show me profile for user 1"}' http://localhost:3000/chat
```

## Project Structure (Brief)

*   `/src`: Contains the main source code.
    *   `/src/agent/agent.js`: LangGraph agent definition, including nodes and graph compilation using `ChatOllama`.
    *   `/src/config/config.js`: Configuration settings (Ollama URL/model, external API base URLs).
    *   `/src/tools/`: Custom Langchain tools.
        *   `example_tool.js`: A simple mock weather tool.
        *   `externalProtocolTool.js`: A tool that calls an external API (JSONPlaceholder).
    *   `/src/utils`: Utility functions (currently none).
*   `/index.js`: Express server setup, middleware, route definitions, and main application entry point.
*   `/__tests__`: Contains all automated tests.
    *   `/unit`: Unit tests, e.g., for individual tools.
    *   `/integration`: Integration tests, e.g., for API endpoints (mocking `ChatOllama`).
*   `package.json`: Project metadata, dependencies, and scripts.
*   `jest.config.js`: Jest test runner configuration.
*   `README.md`: This file.
