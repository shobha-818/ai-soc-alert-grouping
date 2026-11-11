const { checkIPReputation } = require('./services/threatIntel.service');
const { analyzeIncidentWithLLM } = require('./services/llm.service');
const { correlateAlerts } = require('./services/correlation.service');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Single test endpoint
app.get('/api/alerts', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.json({ success: true, count: data.length, alerts: data });
  } catch (err) {
  res.status(500).json({ success: false, error: 'Server error' });
}
});
app.post('/api/alerts', async (req, res) => {
  const {
    alert_type,
    severity,
    username,
    source_ip,
    device,
    destination_ip,
    status
  } = req.body;

  if (!alert_type || !severity) {
    return res.status(400).json({
      success: false,
      error: 'alert_type and severity are required'
    });
  }

  try {
    const { data, error } = await supabase
      .from('alerts')
      .insert([{
        alert_type,
        severity,
        username,
        source_ip,
        device,
        destination_ip,
        status: status || 'OPEN'
      }])
      .select();

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.status(201).json({ success: true, alert: data[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});
app.get('/api/incidents', async (req, res) => {
  try {
    const { data: alerts, error } = await supabase.from('alerts').select('*');
    if (error) return res.status(400).json({ success: false, error: error.message });
    
    const incidents = correlateAlerts(alerts);
    res.json({ success: true, count: incidents.length, incidents });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/api/ai/analyze', async (req, res) => {
  const { incident } = req.body;
  if (!incident) {
    return res.status(400).json({ success: false, error: 'Incident data required' });
  }
  
  const analysis = await analyzeIncidentWithLLM(incident);
  res.json({ success: true, analysis });
});

app.put('/api/alerts/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ success: false, error: 'Status is required' });
  }

  try {
    const { data, error } = await supabase
      .from('alerts')
      .update({ status })
      .eq('id', id)
      .select();

    if (error) return res.status(400).json({ success: false, error: error.message });
    res.json({ success: true, alert: data[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/api/threat-intel', async (req, res) => {
  const { ip } = req.body;
  const result = await checkIPReputation(ip);
  res.json({ success: true, result });
});

// Chat with SOC Analyst
app.post('/api/ai/chat', async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ success: false, error: 'Question required' });

  try {
    // 1. Fetch recent alerts to give the AI context
    const { data: alerts, error } = await supabase
      .from('alerts')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(15); // Send the 15 most recent alerts

    if (error) return res.status(400).json({ success: false, error: error.message });

    // 2. Build the prompt with context
    const context = alerts.map(a => 
      `- Type: ${a.alert_type}, Severity: ${a.severity}, User: ${a.username}, IP: ${a.source_ip || 'N/A'}, Status: ${a.status}`
    ).join('\n');

    const prompt = `You are a helpful SOC Analyst AI assistant. 
Here is the recent security alert data from our system:
${context}

The human analyst asks: "${question}"

Answer their question clearly and professionally based ONLY on the data provided above. Keep your answer under 4 sentences.`;

    // 3. Call Gemini
    const { GoogleGenAI } = require('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt
    });

    res.json({ success: true, answer: response.text });

  } catch (err) {
    console.error('Chat AI error:', err.message);
    res.status(500).json({ success: false, error: 'AI failed to respond' });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Backend running on http://localhost:${process.env.PORT}`);
});