const { DynamicTool } = require("langchain/tools");

/**
 * A simple asynchronous function that simulates getting the current weather.
 * @param {object} input - The input object.
 * @param {string} input.location - The location to get the weather for.
 * @returns {Promise<string>} A promise that resolves to a string describing the weather.
 */
async function getCurrentWeather({ location }) {
  console.log(`Tool: getCurrentWeather called for location: ${location}`);
  // In a real tool, you might make an API call here.
  return `The weather in ${location} is sunny and warm.`;
}

const currentWeatherTool = new DynamicTool({
  name: "get_current_weather",
  description: "Returns the current weather for a given location. Input should be the location string.",
  func: getCurrentWeather,
  // You can define an input schema if needed, for more complex inputs
  // schema: z.object({ location: z.string() })
});

module.exports = { currentWeatherTool };
