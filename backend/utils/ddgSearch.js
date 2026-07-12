const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

/**
 * Searches DuckDuckGo HTML version for the given query and extracts organic results.
 * Useful as a free out-of-the-box fallback search.
 * @param {string} query The search query
 * @returns {Promise<Array<{title: string, snippet: string, link: string}>>}
 */
async function ddgSearch(query) {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 10000,
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });

    const $ = cheerio.load(response.data);
    const results = [];

    $('.result__body').each((i, elem) => {
      if (results.length >= 5) return;
      
      const titleElem = $(elem).find('.result__title a');
      const snippetElem = $(elem).find('.result__snippet');
      
      const title = titleElem.text().trim();
      const link = titleElem.attr('href');
      const snippet = snippetElem.text().trim();
      
      if (title && link) {
        let finalLink = link;
        // Parse the redirect link if it points to DuckDuckGo redirect service
        if (link.includes('uddg=')) {
          try {
            const parts = link.split('?')[1];
            const urlParams = new URLSearchParams(parts);
            finalLink = urlParams.get('uddg') || link;
          } catch (e) {
            // Ignore parsing error and use original link
          }
        }
        
        results.push({
          title,
          snippet,
          link: finalLink.startsWith('//') ? 'https:' + finalLink : finalLink
        });
      }
    });

    return results;
  } catch (error) {
    console.error(`DuckDuckGo search failed for query "${query}":`, error.message);
    return [];
  }
}

module.exports = { ddgSearch };
