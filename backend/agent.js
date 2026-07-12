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
3. A smart reason for this decision.

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

  try {
    const jsonRegex = /\{[\s\S]*\}/;
    const match = content.match(jsonRegex);
    if (match) {
      const parsed = JSON.parse(match[0]);
      companyInfo = parsed.companyInfo || "";
      decision = parsed.decision || "";
      reasoning = parsed.reasoning || "";
    }
  } catch (e) {
    console.warn("⚠️ JSON parse failed, falling back to regex extraction.");
  }

  // Regex Extraction Fallback for each field if parsing was incomplete
  if (!companyInfo.trim()) {
    const match = content.match(/"companyInfo"\s*:\s*"([\s\S]*?)"(?=\s*,\s*"|\s*\})/);
    companyInfo = match ? match[1] : "";
  }
  if (!decision.trim()) {
    const match = content.match(/"decision"\s*:\s*"([\s\S]*?)"(?=\s*,\s*"|\s*\})/);
    decision = match ? match[1] : "";
  }
  if (!reasoning.trim()) {
    const match = content.match(/"reasoning"\s*:\s*"([\s\S]*?)"(?=\s*,\s*"|\s*\})/);
    reasoning = match ? match[1] : "";
  }

  // If extraction fails completely, fall back to parsing the raw output
  if (!companyInfo.trim() && !reasoning.trim()) {
    companyInfo = "Analysis completed.";
    decision = content.toUpperCase().includes("INVEST") ? "INVEST" : "PASS";
    reasoning = content;
  }

  // Clean raw escape tokens from string
  const cleanText = (str) => {
    return str
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .trim();
  };

  return {
    companyInfo: cleanText(companyInfo) || "No details available.",
    decision: decision.trim().toUpperCase() === "INVEST" ? "INVEST" : "PASS",
    reasoning: cleanText(reasoning) || "Failed to generate evaluation thesis."
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
