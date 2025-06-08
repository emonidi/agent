module.exports = {
  MODEL_CONTEXT_API_BASE_URL: "https://jsonplaceholder.typicode.com", // Existing config
  OLLAMA_BASE_URL: "http://localhost:11434",
  OLLAMA_MODEL: "llama3.2:latest", // Or another common model like "codellama", "mistral"
  MCP_SERVERS: {
    // Example server1 (stdio)
    // "math_server": {
    //   "command": "python", // Or "node", "npx", etc.
    //   "args": ["/full/path/to/your/math_server.py"], // IMPORTANT: Update this path to your executable script
    //   "transport": "stdio"
    // },
    // Example server2 (streamable_http)
    // "weather_server": {
    //   "url": "http://localhost:8000/mcp", // IMPORTANT: Ensure this server is running and accessible
    //   "transport": "streamable_http"
    //   // Optional: Add headers for authentication or other purposes
    //   // "headers": {
    //   //   "Authorization": "Bearer YOUR_ACCESS_TOKEN"
    //   // }
    // },
    // Example server3 (sse - Server-Sent Events, a fallback for streamable_http)
    // "news_feed_server": {
    //   "url": "http://localhost:8001/mcp_sse", // IMPORTANT: Ensure this server is running and accessible
    //   "transport": "sse"
    //   // SSE transport might also use headers if required by the server
    //   // "headers": {
    //   //   "X-API-Key": "YOUR_NEWS_API_KEY"
    //   // }
    // }
    // Add more server configurations as needed (e.g., for different tools or environments)
  }
};
