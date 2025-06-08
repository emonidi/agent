# LangGraph Coding Agent Backend

## Description

A Node.js backend for a coding agent that uses LangGraph to manage conversational flow and tool interactions. It can interact with a human user and utilize tools, including external APIs. This project demonstrates a basic setup of an Express server, a LangGraph agent with mocked LLM interactions, and the ability to call custom tools that can interface with external services (e.g., JSONPlaceholder for user profiles).

## Prerequisites

*   Node.js (v18.x or later recommended)
*   npm (Node Package Manager)

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
*   `MODEL_CONTEXT_API_BASE_URL`: Currently set to `https://jsonplaceholder.typicode.com` for the example `fetchUserProfileTool`. This URL is used by the `fetchUserProfileTool` to get dummy user data.
*   **LLM Configuration (Future Placeholder)**: If integrating with actual LLMs like OpenAI, API keys would need to be configured, typically via environment variables. This project currently uses a mock LLM within the agent's `callModelNode` to simulate LLM behavior and tool decisions.

## Running the Application

To start the server:
```bash
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

## API Endpoints

### POST `/chat`

*   **Description**: Sends a message to the agent and receives a response. The agent can reply directly or use tools to gather information before replying.
*   **Request Body**:
    ```json
    {
      "message": "Your message to the agent"
    }
    ```
*   **Example Success Response (Simple Chat - no tool triggered)**:
    ```json
    {
      "response": "I can help with weather or user profiles. Try: 'What is the weather in London?' or 'Get profile for user 2'"
    }
    ```
*   **Example Success Response (Tool Usage - Weather)**:
    After sending `{"message": "What is the weather in Paris?"}`
    ```json
    {
      "response": "I have processed the information: \"The weather in Paris is sunny and warm....\""
    }
    ```
    *(Note: The exact phrasing comes from the mock LLM in `callModelNode` after processing tool output).*
*   **Example Success Response (Tool Usage - User Profile)**:
    After sending `{"message": "Show me profile for user 1"}`
    ```json
    {
      "response": "I have processed the information: \"User Profile for ID 1: Name - Leanne Graham, Email - Sincere@april.biz, City - Gwenborough...\""
    }
    ```
    *(Note: The exact phrasing and data come from the mock LLM processing the `fetchUserProfileTool` output, which calls the JSONPlaceholder API).*
*   **Example Error Response (Bad Request - Missing Message)**:
    ```json
    {
      "error": "Message is required in the request body.",
      "status": 400
    }
    ```
*   **Example Error Response (Server Error - Agent Fails)**:
    ```json
    {
      "error": "Agent failed to process request: [specific error message from agent]",
      "status": 500
    }
    ```

## Example Usage with cURL

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
    *   `/src/agent/agent.js`: LangGraph agent definition, including nodes and graph compilation.
    *   `/src/config/config.js`: Configuration settings (e.g., external API base URLs).
    *   `/src/tools/`: Custom Langchain tools.
        *   `example_tool.js`: A simple mock weather tool.
        *   `externalProtocolTool.js`: A tool that calls an external API (JSONPlaceholder).
    *   `/src/utils`: Utility functions (currently none).
*   `/index.js`: Express server setup, middleware, route definitions, and main application entry point.
*   `/__tests__`: Contains all automated tests.
    *   `/unit`: Unit tests, e.g., for individual tools.
    *   `/integration`: Integration tests, e.g., for API endpoints.
*   `package.json`: Project metadata, dependencies, and scripts.
*   `jest.config.js`: Jest test runner configuration.
*   `README.md`: This file.
