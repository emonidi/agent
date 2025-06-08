const { DynamicTool } = require("langchain/tools");
const axios = require("axios");
const { MODEL_CONTEXT_API_BASE_URL } = require("../config/config.js");

/**
 * Fetches user profile information from an external API.
 * @param {object} input - The input object.
 * @param {string} input.userId - The ID of the user to fetch.
 * @returns {Promise<string>} A promise that resolves to user profile data (e.g., name and email) or an error message.
 */
async function fetchUserProfile({ userId }) {
  if (!userId) {
    return "Error: userId is required to fetch user profile.";
  }
  const url = `${MODEL_CONTEXT_API_BASE_URL}/users/${userId}`;
  console.log(`Tool: fetchUserProfile attempting to GET ${url}`);
  try {
    const response = await axios.get(url);
    if (response.data) {
      // Return a small, relevant piece of data
      return `User Profile for ID ${userId}: Name - ${response.data.name}, Email - ${response.data.email}, City - ${response.data.address?.city}`;
    } else {
      return `No data found for user ID ${userId}.`;
    }
  } catch (error) {
    console.error(`Tool: fetchUserProfile error fetching user ID ${userId}:`, error.message);
    if (error.response) {
      return `Error fetching user profile for ID ${userId}: API responded with status ${error.response.status} - ${error.response.statusText}.`;
    } else if (error.request) {
      return `Error fetching user profile for ID ${userId}: No response received from API.`;
    } else {
      return `Error fetching user profile for ID ${userId}: ${error.message}.`;
    }
  }
}

const fetchUserProfileTool = new DynamicTool({
  name: "fetch_user_profile",
  description: "Fetches a user's profile information (name, email, city) from an external system using their user ID.",
  func: fetchUserProfile,
  // schema: z.object({ userId: z.string().describe("The ID of the user to fetch.") }) // Example schema
});

module.exports = { fetchUserProfileTool };
