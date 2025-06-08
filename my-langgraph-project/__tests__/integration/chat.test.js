const request = require('supertest');
const { app, server } = require('../../index.js'); // Import the Express app
const axios = require('axios');
const { AIMessage } = require('@langchain/core/messages'); // Import AIMessage

// Mock ChatOllama by mocking the @langchain/community package
const mockBoundInvoke = jest.fn();
jest.mock('@langchain/community', () => {
  // This is the factory function for the mock.
  // It needs to return an object that has the structure of the actual module.
  const actualCommunity = jest.requireActual('@langchain/community'); // Get actual for other exports if needed

  const MockChatOllama = jest.fn().mockImplementation(function(config) {
    this.config = config;
    this.bindTools = jest.fn().mockReturnValue({
      invoke: mockBoundInvoke,
    });
    this.invoke = jest.fn(); // Mock direct invoke as well
    return this;
  });

  return {
    ...actualCommunity, // Spread other actual exports from @langchain/community
    chat_models: { // This is the key: provide the chat_models path
      ...actualCommunity.chat_models,
      ollama: { // And the ollama path
        ...actualCommunity.chat_models?.ollama,
        ChatOllama: MockChatOllama, // Override only ChatOllama
      }
    }
  };
});

// Mock axios for fetchUserProfileTool
// This is already handled by the __mocks__/axios.js file if `jest.mock('axios')` is called,
// or can be explicitly mocked here if needed without the __mocks__ folder.
// For clarity, if __mocks__/axios.js exists, jest.mock('axios'); is sufficient.
jest.mock('axios');

describe('POST /chat Integration Tests with Mocked ChatOllama', () => {
  afterAll((done) => {
    if (server && server.listening) {
      server.close(done);
    } else {
      done();
    }
  });

  beforeEach(() => {
    mockBoundInvoke.mockReset();
    if (axios.get && axios.get.mockReset) { // axios.get might be undefined if __mocks__ version is simpler
        axios.get.mockReset();
    }
  });

  it('should return a direct AI response for a simple message', async () => {
    mockBoundInvoke.mockResolvedValue(new AIMessage("Hello from mocked Ollama for simple message!"));
    const response = await request(app)
      .post('/chat')
      .send({ message: 'Hello agent' });
    expect(response.statusCode).toBe(200);
    expect(response.body.response).toBe("Hello from mocked Ollama for simple message!");
    expect(mockBoundInvoke).toHaveBeenCalledTimes(1);
  });

  it('should trigger currentWeatherTool and return its processed output', async () => {
    mockBoundInvoke.mockResolvedValueOnce(
      new AIMessage({
        content: "Okay, I'll get the weather for Testville.",
        tool_calls: [{ name: "get_current_weather", args: { location: "Testville" }, id: "tool_call_weather_123" }],
      })
    );
    mockBoundInvoke.mockResolvedValueOnce(
      new AIMessage("The weather in Testville is sunny and warm, processed by mock Ollama.")
    );
    const response = await request(app)
      .post('/chat')
      .send({ message: 'What is the weather in Testville?' });
    expect(response.statusCode).toBe(200);
    expect(response.body.response).toBe("The weather in Testville is sunny and warm, processed by mock Ollama.");
    expect(mockBoundInvoke).toHaveBeenCalledTimes(2);
  });

  it('should trigger fetchUserProfileTool and return data from mocked axios call, processed by LLM', async () => {
    const mockAxiosUserData = {
      id: "1", name: "Klementina DuBuque", email: "Rey.Padberg@karina.biz", address: { city: "Gwenborough" },
    };
    axios.get.mockResolvedValue({ data: mockAxiosUserData });
    mockBoundInvoke.mockResolvedValueOnce(
      new AIMessage({
        content: "Fetching user profile for ID 1...",
        tool_calls: [{ name: "fetch_user_profile", args: { userId: "1" }, id: "tool_call_profile_456" }],
      })
    );
    const toolOutputString = `User Profile for ID 1: Name - ${mockAxiosUserData.name}, Email - ${mockAxiosUserData.email}, City - ${mockAxiosUserData.address.city}`;
    mockBoundInvoke.mockResolvedValueOnce(
      new AIMessage(`User Klementina DuBuque's profile processed: ${toolOutputString}`)
    );
    const response = await request(app)
      .post('/chat')
      .send({ message: 'Show me profile for user 1' });
    expect(response.statusCode).toBe(200);
    expect(axios.get).toHaveBeenCalledWith("https://jsonplaceholder.typicode.com/users/1");
    expect(response.body.response).toBe(`User Klementina DuBuque's profile processed: ${toolOutputString}`);
    expect(mockBoundInvoke).toHaveBeenCalledTimes(2);
  });

  it('should return 400 if message is not provided', async () => {
    const response = await request(app).post('/chat').send({});
    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe('Message is required in the request body.');
    expect(mockBoundInvoke).not.toHaveBeenCalled();
  });

  it('should handle LLM error during initial call', async () => {
    mockBoundInvoke.mockRejectedValue(new Error("Ollama connection failed"));
    const response = await request(app)
      .post('/chat')
      .send({ message: 'Any message' });
    expect(response.statusCode).toBe(500);
    expect(response.body.error).toContain("Agent failed to process request: Error calling LLM: Ollama connection failed");
  });

  it('should handle tool error if LLM calls a non-existent tool', async () => {
    mockBoundInvoke.mockResolvedValueOnce(
      new AIMessage({
        content: "Trying to use a weird tool...",
        tool_calls: [{ name: "non_existent_tool", args: { param: "value" }, id: "tool_call_weird_789" }],
      })
    );
    mockBoundInvoke.mockResolvedValueOnce(
      new AIMessage("It seems I tried to use a tool that doesn't exist. My apologies.")
    );
    const response = await request(app)
      .post('/chat')
      .send({ message: 'Use a non_existent_tool' });
    expect(response.statusCode).toBe(200);
    expect(response.body.response).toBe("It seems I tried to use a tool that doesn't exist. My apologies.");
    expect(mockBoundInvoke).toHaveBeenCalledTimes(2);
  });
});
