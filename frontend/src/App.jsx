import React, { useState } from 'react';
import './App.css';

export default function App() {
  const [companyName, setCompanyName] = useState('');
  const [provider, setProvider] = useState('gemini');
  const [modelName, setModelName] = useState('gemini-1.5-flash');
  const [apiKey, setApiKey] = useState('');
  const [tavilyKey, setTavilyKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleResearchSubmit = async (e) => {
    e.preventDefault();
    if (!companyName.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('http://localhost:5000/api/research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName: companyName.trim(),
          provider,
          modelName,
          apiKey: apiKey.trim(),
          tavilyKey: tavilyKey.trim(),
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Server responded with an error.');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to connect to backend server.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    
    // Dynamic import to prevent initial bundle load overhead
    import('jspdf').then(({ jsPDF }) => {
      const doc = new jsPDF();
      
      const getCleanDisplay = (text, fieldName) => {
        if (!text || typeof text !== 'string') return text;
        const trimmed = text.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          try {
            const parsed = JSON.parse(trimmed);
            return parsed[fieldName] || parsed.reasoning || parsed.companyInfo || text;
          } catch (e) {
            const regex = new RegExp(`"${fieldName}"\\s*:\\s*"([\\s\\S]*?)"(?=\\s*,\\s*"|\\s*\\})`);
            const match = trimmed.match(regex);
            if (match) return match[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
          }
        }
        return text;
      };

      const cleanInfo = getCleanDisplay(result.companyInfo, 'companyInfo');
      const cleanReasoning = getCleanDisplay(result.reasoning, 'reasoning');

      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(36, 41, 46);
      doc.text(`INVESTMENT REPORT: ${result.companyName.toUpperCase()}`, 14, 22);
      
      // Divider
      doc.setDrawColor(225, 228, 232);
      doc.line(14, 27, 196, 27);
      
      // Recommendation Section
      doc.setFontSize(13);
      doc.text("RECOMMENDATION:", 14, 38);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      if (result.decision === "INVEST") {
        doc.setTextColor(46, 164, 79); // Solid Green
      } else {
        doc.setTextColor(207, 34, 46); // Solid Red
      }
      doc.text(result.decision, 70, 38);
      
      // Reset font & color
      doc.setTextColor(36, 41, 46);
      
      // Section 1: Overview
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("1. COMPANY PROFILE & OVERVIEW", 14, 52);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      const infoLines = doc.splitTextToSize(cleanInfo, 180);
      doc.text(infoLines, 14, 59);
      
      // Calculate Y coordinate based on text height
      const infoHeight = infoLines.length * 5;
      const reasoningY = 59 + infoHeight + 15;
      
      // Section 2: Reasoning Thesis
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("2. INVESTMENT REASONING THESIS", 14, reasoningY);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      const reasoningLines = doc.splitTextToSize(cleanReasoning, 180);
      doc.text(reasoningLines, 14, reasoningY + 7);
      
      // Save PDF file
      doc.save(`investify_${result.companyName.toLowerCase()}_report.pdf`);
    }).catch(err => {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF report.");
    });
  };

  return (
    <div className="container">
      <header className="header">
        <div className="logo-container">
          <img src="/download.png" alt="Investify Logo" className="app-logo" />
          <h1>Investify</h1>
        </div>
        <p>Enter a company name to query the web and evaluate whether to INVEST or PASS.</p>
      </header>

      <main className="main">
        <form onSubmit={handleResearchSubmit} className="search-box">
          <div className="input-row">
            <input
              type="text"
              placeholder="Enter company name (e.g. Tesla, Nvidia)..."
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={loading}
              required
            />
            <button type="submit" disabled={loading || !companyName.trim()}>
              {loading ? 'Evaluating...' : 'Research'}
            </button>
          </div>

          <div className="toggle-container">
            <button
              type="button"
              className="toggle-link"
              onClick={() => setShowSettings(!showSettings)}
            >
              {showSettings ? '▲ Hide Settings' : '▼ Show Settings (API Keys)'}
            </button>
          </div>

          {showSettings && (
            <div className="settings-panel">
              <div className="form-group">
                <label>LLM Provider</label>
                <select
                  value={provider}
                  onChange={(e) => {
                    setProvider(e.target.value);
                    setModelName(e.target.value === 'openai' ? 'gpt-4o-mini' : e.target.value === 'ollama' ? 'llama3.2' : 'gemini-1.5-flash');
                  }}
                  disabled={loading}
                >
                  <option value="gemini">Gemini API</option>
                  <option value="openai">OpenAI API</option>
                  <option value="ollama">Local Llama (Ollama)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Model Name</label>
                <select
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  disabled={loading}
                >
                  {provider === 'ollama' ? (
                    <>
                      <option value="llama3.2">llama3.2</option>
                      <option value="llama3.1">llama3.1</option>
                      <option value="llama3">llama3</option>
                      <option value="mistral">mistral</option>
                      <option value="phi3">phi3</option>
                    </>
                  ) : provider === 'gemini' ? (
                    <>
                      <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                      <option value="gemini-1.5-flash-latest">gemini-1.5-flash-latest</option>
                      <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                      <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                    </>
                  ) : (
                    <>
                      <option value="gpt-4o-mini">gpt-4o-mini</option>
                      <option value="gpt-4o">gpt-4o</option>
                      <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                    </>
                  )}
                </select>
              </div>

              <div className="form-group">
                <label>Custom LLM API Key (Optional)</label>
                <input
                  type="password"
                  placeholder="Enter API key..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label>Custom Tavily API Key (Optional)</label>
                <input
                  type="password"
                  placeholder="Enter Tavily key..."
                  value={tavilyKey}
                  onChange={(e) => setTavilyKey(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
          )}
        </form>

        {loading && (
          <div className="status-box">
            <span className="spinner"></span> Searching web results and generating analysis...
          </div>
        )}

        {error && (
          <div className="error-box">
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && (() => {
          const getCleanDisplay = (text, fieldName) => {
            if (!text || typeof text !== 'string') return text;
            const trimmed = text.trim();
            if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
              try {
                const parsed = JSON.parse(trimmed);
                return parsed[fieldName] || parsed.reasoning || parsed.companyInfo || text;
              } catch (e) {
                // Regex capture key value from raw JSON block
                const regex = new RegExp(`"${fieldName}"\\s*:\\s*"([\\s\\S]*?)"(?=\\s*,\\s*"|\\s*\\})`);
                const match = trimmed.match(regex);
                if (match) return match[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
              }
            }
            return text;
          };

          const cleanInfo = getCleanDisplay(result.companyInfo, 'companyInfo');
          const cleanReasoning = getCleanDisplay(result.reasoning, 'reasoning');

          return (
            <div className="results-card">
              <div className="card-header">
                <h2>Research Report: {result.companyName}</h2>
                <button onClick={handleDownload} className="btn-download">Download Report</button>
              </div>
              
              <div className="info-section">
                <h3>Company Profile & Overview</h3>
                <p>{cleanInfo}</p>
              </div>

              <div className="decision-section">
                <h3>Investment Recommendation</h3>
                <div className={`decision-badge ${result.decision === 'INVEST' ? 'badge-invest' : 'badge-pass'}`}>
                  {result.decision}
                </div>
              </div>

              <div className="reasoning-section">
                <h3>Reasoning Thesis</h3>
                <p>{cleanReasoning}</p>
              </div>
            </div>
          );
        })()}
      </main>
    </div>
  );
}
