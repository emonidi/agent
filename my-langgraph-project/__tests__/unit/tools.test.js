const { DynamicTool } = require("langchain/tools");
const { currentWeatherTool } = require("../../src/tools/example_tool.js");
const { fetchUserProfileTool } = require("../../src/tools/externalProtocolTool.js");
const axios = require("axios");

// Mock axios globally for all tests in this file
jest.mock('axios');

describe("Tool Tests", () => {
  describe("currentWeatherTool", () => {
    it("should be an instance of DynamicTool", () => {
      expect(currentWeatherTool).toBeInstanceOf(DynamicTool);
    });

    it("should have the correct name", () => {
      expect(currentWeatherTool.name).toBe("get_current_weather");
    });

    it("should return the mocked weather string", async () => {
      const result = await currentWeatherTool.invoke({ location: "Testville" });
      expect(result).toBe("The weather in Testville is sunny and warm.");
    });
  });

  describe("fetchUserProfileTool", () => {
    beforeEach(() => {
      // Clear mock history and reset behavior before each test
      axios.get.mockReset();
    });

    it("should be an instance of DynamicTool", () => {
      expect(fetchUserProfileTool).toBeInstanceOf(DynamicTool);
    });

    it("should have the correct name", () => {
      expect(fetchUserProfileTool.name).toBe("fetch_user_profile");
    });

    it("should call axios.get with the correct URL and return processed data", async () => {
      const mockUserData = {
        id: "1",
        name: "Leanne Graham",
        email: "Sincere@april.biz",
        address: { city: "Gwenborough" },
      };
      axios.get.mockResolvedValue({ data: mockUserData });

      const result = await fetchUserProfileTool.invoke({ userId: "1" });
      expect(axios.get).toHaveBeenCalledTimes(1);
      expect(axios.get).toHaveBeenCalledWith("https://jsonplaceholder.typicode.com/users/1");
      expect(result).toBe("User Profile for ID 1: Name - Leanne Graham, Email - Sincere@april.biz, City - Gwenborough");
    });

    it("should return an error message if userId is not provided", async () => {
      const result = await fetchUserProfileTool.invoke({}); // No userId
      expect(result).toBe("Error: userId is required to fetch user profile.");
      expect(axios.get).not.toHaveBeenCalled();
    });

    it("should handle API errors (e.g., 404 Not Found)", async () => {
      axios.get.mockRejectedValue({
        isAxiosError: true,
        response: { status: 404, statusText: "Not Found" },
        message: "Request failed with status code 404"
      });

      const result = await fetchUserProfileTool.invoke({ userId: "unknown" });
      expect(axios.get).toHaveBeenCalledWith("https://jsonplaceholder.typicode.com/users/unknown");
      expect(result).toBe("Error fetching user profile for ID unknown: API responded with status 404 - Not Found.");
    });

    it("should handle network errors (no response from API)", async () => {
      axios.get.mockRejectedValue({
        isAxiosError: true,
        request: {}, // Indicates a request was made but no response received
        message: "Network Error"
      });
      const result = await fetchUserProfileTool.invoke({ userId: "neterror" });
      expect(result).toBe("Error fetching user profile for ID neterror: No response received from API.");
    });

    it("should handle other types of errors during API call", async () => {
      axios.get.mockRejectedValue(new Error("Unexpected error"));
      const result = await fetchUserProfileTool.invoke({ userId: "othererror" });
      expect(result).toBe("Error fetching user profile for ID othererror: Unexpected error.");
    });

    it("should return 'No data found' if API returns empty data", async () => {
      axios.get.mockResolvedValue({ data: null }); // Or data: {}
      const result = await fetchUserProfileTool.invoke({ userId: "empty" });
      expect(result).toBe("No data found for user ID empty.");
    });
  });
});
