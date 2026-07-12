const { StateGraph, START, END } = require("@langchain/langgraph");
const { searchWeb } = require("./utils/search");
const { getModel } = require("./model");

// State representation
const stateChannels = {
  companyName: {
    value: (x, y) => y ?? x,
    default: () => ""
  },
  searchContent: {
    value: (x, y) => y ?? x,
    default: () => ""
  },
  companyInfo: {
    value: (x, y) => y ?? x,
    default: () => ""
  },
  decision: {
    value: (x, y) => y ?? x,
    default: () => ""
  },
  reasoning: {
    value: (x, y) => y ?? x,
    default: () => ""
  }
};

// Node 1: Search the web for simple data
async function researchNode(state, config) {
  const { companyName } = state;
  const tavilyKey = config.configurable?.tavilyKey;
  
  // Search the web once (cap to top 3 results for performance)
  const results = await searchWeb(`${companyName} company overview financials news`, null, tavilyKey);
  const searchContent = results.slice(0, 3).map(r => `Title: ${r.title}\nContent: ${r.snippet}\n`).join('\n');
  
  return { searchContent };
}

// Node 2: Extract info and make final decision
async function evaluateNode(state, config) {
  const { companyName, searchContent } = state;
  const provider = config.configurable?.provider;
  const apiKey = config.configurable?.apiKey;
  const modelName = config.configurable?.modelName;
  
  const model = getModel(provider, apiKey, modelName);
  
  const prompt = `You are a simple investment research assistant. Study the search results below for "${companyName}":
${searchContent}

Based on these results, provide:
1. Some descriptive information about the company (Overview, main products/services, and size/financials if available).
2. A clear investment decision (either "INVEST" or "PASS").
3. A good reason for this decision.

Output a JSON object exactly matching this schema:
{
  "companyInfo": "Plain text summary of the company description.",
  "decision": "INVEST" or "PASS",
  "reasoning": "Brief explanation of why you made this decision."
}

Do not include any other text besides the JSON.`;

  const response = await model.invoke(prompt);
  const content = response.content;
  
  let companyInfo = "";
  let decision = "";
  let reasoning = "";

  // Helper to escape raw newlines inside double-quoted values in JSON
  const escapeNewlinesInStrings = (str) => {
    let inString = false;
    let res = '';
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      if (c === '"' && (i === 0 || str[i - 1] !== '\\')) {
        inString = !inString;
      }
      if (inString && c === '\n') {
        res += '\\n';
      } else if (inString && c === '\r') {
        // Skip carriage return
      } else {
        res += c;
      }
    }
    return res;
  };

  try {
    const jsonRegex = /\{[\s\S]*\}/;
    const match = content.match(jsonRegex);
    if (match) {
      const cleanedJson = escapeNewlinesInStrings(match[0]);
      const parsed = JSON.parse(cleanedJson);
      companyInfo = parsed.companyInfo || parsed.company_info || parsed.CompanyInfo || "";
      decision = parsed.decision || parsed.recommendation || parsed.Decision || "";
      reasoning = parsed.reasoning || parsed.thesis || parsed.Reasoning || "";
    }
  } catch (e) {
    console.warn("⚠️ JSON parse failed: " + e.message);
  }

  // Regex Extraction Fallback for each field if parsing was incomplete or returned empty
  if (!companyInfo.trim()) {
    const match = content.match(/"companyInfo"\s*:\s*"([\s\S]*?)"/i) || 
                  content.match(/"company_info"\s*:\s*"([\s\S]*?)"/i);
    companyInfo = match ? match[1] : "";
  }
  if (!decision.trim()) {
    const match = content.match(/"decision"\s*:\s*"([\s\S]*?)"/i) || 
                  content.match(/"recommendation"\s*:\s*"([\s\S]*?)"/i);
    decision = match ? match[1] : "";
  }
  if (!reasoning.trim()) {
    const match = content.match(/"reasoning"\s*:\s*"([\s\S]*?)"/i) || 
                  content.match(/"thesis"\s*:\s*"([\s\S]*?)"/i);
    reasoning = match ? match[1] : "";
  }

  // Clean raw escape tokens from string helper
  const cleanText = (str) => {
    return str
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .trim();
  };

  companyInfo = cleanText(companyInfo);
  decision = cleanText(decision).toUpperCase();
  reasoning = cleanText(reasoning);

  // If extraction fails completely or is empty, use the raw content as reasoning fallback
  if (!reasoning.trim()) {
    reasoning = cleanText(content);
  }
  if (!companyInfo.trim()) {
    companyInfo = "Overview details completed.";
  }
  if (!decision.trim()) {
    decision = content.toUpperCase().includes("INVEST") ? "INVEST" : "PASS";
  }

  return {
    companyInfo: companyInfo || "No details available.",
    decision: decision === "INVEST" ? "INVEST" : "PASS",
    reasoning: reasoning || "Failed to generate evaluation thesis."
  };
}

const workflow = new StateGraph({
  channels: stateChannels
})
  .addNode("research", researchNode)
  .addNode("evaluate", evaluateNode)
  .addEdge(START, "research")
  .addEdge("research", "evaluate")
  .addEdge("evaluate", END);

const agentExecutor = workflow.compile();

module.exports = { agentExecutor };
