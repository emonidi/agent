// jest.config.js
module.exports = {
  testEnvironment: 'node',
  moduleNameMapper: {
    // Map specific deep imports to their parent package, hoping Jest resolves the specifics
    "^langchain/tools$": "langchain",
    "^@langchain/core/messages$": "@langchain/core",
    "^@langchain/community/chat_models/ollama$": "@langchain/community",
    // Keep the axios mock explicit if the __mocks__ folder isnt picked up reliably by default
    // "^axios$": "<rootDir>/__mocks__/axios.js" // This line might be redundant if __mocks__ works
  },
  // Automatically clear mock calls and instances between every test
  // clearMocks: true,
  // transformIgnorePatterns: ["node_modules/(?!(@langchain|langchain)/)"], // If transpilation issues arise with these packages
};
