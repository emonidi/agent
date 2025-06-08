const request = require('supertest');
const { app, server } = require('../../index.js'); // Import the Express app and server
const axios = require('axios');

// Mock axios globally for all tests in this file, as agent uses it via fetchUserProfileTool
jest.mock('axios');
// Mock the example_tool's direct functionality if it had any side effects not covered by simple output
// jest.mock('../../src/tools/example_tool.js', () => ({
//   currentWeatherTool: {
//     name: "get_current_weather",
//     invoke: jest.fn().mockResolvedValue("The weather in Mocksville is perfectly mocked."),
//   }
// }));


describe('POST /chat Integration Tests', () => {
  // Teardown server after all tests are done
  afterAll((done) => {
    if (server && server.listening) {
      server.close(done);
    } else {
      done(); // If server wasn't started or already closed
    }
  });

  beforeEach(() => {
    // Reset axios mocks before each test
    axios.get.mockReset();
  });

  it('should return a direct AI response for a simple message', async () => {
    const response = await request(app)
      .post('/chat')
      .send({ message: 'Hello agent' });
    expect(response.statusCode).toBe(200);
    expect(response.body.response).toBe("I can help with weather or user profiles. Try: 'What is the weather in London?' or 'Get profile for user 2'");
  });

  it('should trigger currentWeatherTool and return its mocked output', async () => {
    // The actual example_tool.js doesn't need mocking if its func is simple and predictable.
    // If it made external calls, we would mock it like axios.
    const response = await request(app)
      .post('/chat')
      .send({ message: 'What is the weather in Testville?' });
    expect(response.statusCode).toBe(200);
    // The agent's callModelNode processes the tool's output.
    // Expected: "I have processed the information: \"The weather in Testville is sunny and warm....\""
    expect(response.body.response).toContain("I have processed the information: \"The weather in Testville is sunny and warm.");
  });

  it('should trigger fetchUserProfileTool and return data from mocked axios call', async () => {
    const mockUserData = {
      id: "1",
      name: "Klementina DuBuque",
      email: "Rey.Padberg@karina.biz",
      address: { city: "Gwenborough" }, // Corrected city for user 1 based on typical JSONPlaceholder
    };
    axios.get.mockResolvedValue({ data: mockUserData });

    const response = await request(app)
      .post('/chat')
      .send({ message: 'Show me profile for user 1' });

    expect(response.statusCode).toBe(200);
    expect(axios.get).toHaveBeenCalledWith("https://jsonplaceholder.typicode.com/users/1");
    // Check for the agent's response after processing the tool's output
    expect(response.body.response).toContain(`I have processed the information: "User Profile for ID 1: Name - ${mockUserData.name}, Email - ${mockUserData.email}, City - ${mockUserData.address.city}`);
  });

  it('should return 400 if message is not provided', async () => {
    const response = await request(app)
      .post('/chat')
      .send({});
    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe('Message is required in the request body.');
  });

  it('should handle errors from fetchUserProfileTool (e.g., user not found)', async () => {
    axios.get.mockRejectedValue({
      isAxiosError: true,
      response: { status: 404, statusText: "Not Found" },
      message: "Request failed with status code 404"
    });

    const response = await request(app)
      .post('/chat')
      .send({ message: 'Show me profile for user 999' }); // Assuming user 999 doesn't exist

    expect(response.statusCode).toBe(200); // The agent itself doesn't crash
    expect(axios.get).toHaveBeenCalledWith("https://jsonplaceholder.typicode.com/users/999");
    // The agent should report that it processed the error information from the tool
    expect(response.body.response).toContain("I have processed the information: \"Error fetching user profile for ID 999: API responded with status 404 - Not Found.");
  });
});
