const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { ChatOpenAI } = require('@langchain/openai');
const axios = require('axios');

/**
 * Custom wrapper for local Ollama chat API.
 * Emulates the LangChain base model `.invoke()` pattern.
 */
class ChatOllamaLocal {
  constructor(modelName) {
    this.modelName = modelName || 'llama3.2';
    this.endpoint = 'http://localhost:11434/api/chat';
  }

  async invoke(prompt) {
    try {
      const response = await axios.post(this.endpoint, {
        model: this.modelName,
        messages: [
          { role: 'user', content: prompt }
        ],
        stream: false
      }, {
        timeout: 120000 // 2-minute timeout for slower local CPUs
      });

      if (response.data && response.data.message) {
        return {
          content: response.data.message.content
        };
      }
      throw new Error('Unexpected response format from Ollama.');
    } catch (error) {
      if (error.code === 'ECONNREFUSED' || error.message.includes('connrefused')) {
        throw new Error('Local Ollama server is not running on http://localhost:11434. Please install Ollama from https://ollama.com and run your model (e.g. "ollama run llama3.2") before executing research.');
      }
      throw new Error(`Ollama model error: ${error.message}`);
    }
  }
}

/**
 * Initializes the appropriate LLM chat model based on provider, custom key, and custom model.
 * Falls back to environment variables and defaults.
 * @param {string} provider 'gemini', 'openai', or 'ollama'
 * @param {string} customKey Client-provided API key
 * @param {string} customModel Client-provided model name
 * @param {Function} logCallback Log status callback
 * @returns {import('@langchain/core/language_models/chat_models').BaseChatModel|ChatOllamaLocal}
 */
function getModel(provider, customKey, customModel, logCallback) {
  const finalProvider = provider || 'gemini';
  
  if (finalProvider === 'ollama') {
    const modelName = customModel || 'llama3.2';
    if (logCallback) logCallback(`🤖 Initialized Local Llama via Ollama (${modelName})`);
    return new ChatOllamaLocal(modelName);
  }
  
  if (finalProvider === 'deepseek') {
    const key = customKey || process.env.DEEPSEEK_API_KEY;
    if (!key || key.trim() === '') {
      throw new Error('DeepSeek API Key is missing. Please enter it in the app settings or configure it in the backend .env file.');
    }
    const modelName = customModel || 'deepseek-chat';
    if (logCallback) logCallback(`🤖 Initialized DeepSeek Model (${modelName})`);
    return new ChatOpenAI({
      apiKey: key.trim(),
      model: modelName,
      configuration: {
        baseURL: 'https://api.deepseek.com/v1'
      },
      temperature: 0.2
    });
  }
  
  if (finalProvider === 'openai') {
    const key = customKey || process.env.OPENAI_API_KEY;
    if (!key || key.trim() === '') {
      throw new Error('OpenAI API Key is missing. Please enter it in the app settings or configure it in the backend .env file.');
    }
    const modelName = customModel || 'gpt-4o-mini';
    if (logCallback) logCallback(`🤖 Initialized OpenAI Model (${modelName})`);
    return new ChatOpenAI({
      apiKey: key.trim(),
      model: modelName,
      temperature: 0.2
    });
  } else {
    // Default to Gemini
    const key = customKey || process.env.GEMINI_API_KEY;
    if (!key || key.trim() === '') {
      throw new Error('Gemini API Key is missing. Please enter it in the app settings or configure it in the backend .env file.');
    }
    const modelName = customModel || 'gemini-2.5-flash';
    if (logCallback) logCallback(`🤖 Initialized Gemini Model (${modelName})`);
    return new ChatGoogleGenerativeAI({
      apiKey: key.trim(),
      model: modelName,
      temperature: 0.2
    });
  }
}

module.exports = { getModel };
