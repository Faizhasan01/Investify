const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { agentExecutor } = require('./agent');

dotenv.config();

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

const PORT = process.env.PORT || 5000;

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Investment Research Backend is running.' });
});

// Simple POST endpoint to handle investment research
app.post('/api/research', async (req, res) => {
  const { companyName, provider, apiKey, tavilyKey, modelName } = req.body;
  
  if (!companyName || companyName.trim() === '') {
    return res.status(400).json({ error: 'Company name is required.' });
  }

  try {
    console.log(`🤖 Starting evaluation workflow for "${companyName.trim()}"...`);
    
    // Invoke the simplified LangGraph workflow
    const result = await agentExecutor.invoke(
      {
        companyName: companyName.trim()
      },
      {
        configurable: {
          provider: provider || 'gemini',
          modelName: modelName || null,
          apiKey: apiKey || null,
          tavilyKey: tavilyKey || null
        }
      }
    );

    console.log(`✅ Evaluation complete for "${companyName.trim()}": ${result.decision}`);
    res.json(result);
  } catch (error) {
    console.error('Agent execution error:', error);
    res.status(500).json({ error: error.message || 'An error occurred during company evaluation.' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
