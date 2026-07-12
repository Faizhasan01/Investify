const axios = require('axios');
const { ddgSearch } = require('./ddgSearch');

/**
 * Perform a web search using Tavily if API key is provided, 
 * or fallback to scraped DuckDuckGo search if not.
 * @param {string} query The search query
 * @param {Function} logCallback Callback to send log messages to client
 * @returns {Promise<Array<{title: string, snippet: string, link: string}>>}
 */
async function searchWeb(query, logCallback, customTavilyKey) {
  const tavilyKey = customTavilyKey || process.env.TAVILY_API_KEY;
  
  if (tavilyKey && tavilyKey.trim() !== '') {
    if (logCallback) logCallback(`🔍 Querying Tavily Search API for: "${query}"`);
    try {
      const response = await axios.post('https://api.tavily.com/search', {
        api_key: tavilyKey.trim(),
        query: query,
        search_depth: 'advanced',
        include_answer: false,
        max_results: 5
      }, {
        timeout: 10000
      });
      
      if (response.data && response.data.results) {
        return response.data.results.map(r => ({
          title: r.title,
          snippet: r.content || r.snippet || '',
          link: r.url
        }));
      }
    } catch (error) {
      if (logCallback) logCallback(`⚠️ Tavily API failed (${error.message}). Falling back to DuckDuckGo scraper...`);
    }
  }
  
  if (logCallback) logCallback(`🔍 Querying DuckDuckGo Scraper for: "${query}"`);
  return await ddgSearch(query);
}

module.exports = { searchWeb };
