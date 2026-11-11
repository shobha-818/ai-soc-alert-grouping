const { GoogleGenAI } = require('@google/genai');

async function analyzeIncidentWithLLM(incident) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const prompt = `You are a SOC analyst assistant. Analyze this security incident and return ONLY valid JSON, no markdown.
  
Incident: ${incident.type}
Username: ${incident.username}
Reason: ${incident.reason}
Severity: ${incident.severity}

Return JSON with exactly these fields:
{
  "title": "short incident title",
  "attackPattern": "description of suspected attack",
  "mitreId": "The MITRE ATT&CK Technique ID and name (e.g., T1110 - Brute Force)",
  "riskLevel": "HIGH or CRITICAL",
  "recommendedResponse": ["action 1", "action 2", "action 3"],
  "analystSummary": "2-3 sentence summary for SOC analyst"
}`;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt
    });
    
    let text = response.text;
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (err) {
    console.error('LLM error:', err.message);
    return {
      title: incident.type + ' – ' + incident.username,
      attackPattern: incident.reason,
      mitreId: 'N/A',
      riskLevel: incident.severity,
      recommendedResponse: ['Investigate alerts', 'Verify user activity', 'Review IPs'],
      analystSummary: `Automated analysis unavailable. Rule-based detection identified ${incident.type} for user ${incident.username}.`
    };
  }
}

module.exports = { analyzeIncidentWithLLM };