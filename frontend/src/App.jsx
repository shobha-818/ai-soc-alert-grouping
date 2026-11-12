import { useState, useEffect } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import './App.css';

const API_URL = 'https://ai-soc-alert-grouping.onrender.com';

function App() {
  // State
  const [ipIntel, setIpIntel] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [aiAnalysis, setAiAnalysis] = useState({});
  const [form, setForm] = useState({ alert_type: '', severity: '', username: '' });
  const [loadingAi, setLoadingAi] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Chat State
  const [chatQuestion, setChatQuestion] = useState('');
  const [chatAnswer, setChatAnswer] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Fetch Functions
  const fetchAlerts = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/alerts`);
      setAlerts(res.data.alerts);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchIncidentsAndAnalyze = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/incidents`);
      setIncidents(res.data.incidents);

      if (res.data.incidents.length > 0) {
        setLoadingAi(true);
        const analyses = {};
        
        for (const incident of res.data.incidents) {
          const aiRes = await axios.post(`${API_URL}/api/ai/analyze`, { incident });
          analyses[incident.username] = aiRes.data.analysis;
        }
        
        setAiAnalysis(analyses);
        setLoadingAi(false);
      }
    } catch (err) {
      console.error(err);
      setLoadingAi(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    fetchIncidentsAndAnalyze();
  }, []);

  // Handlers
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/alerts`, form);
      setForm({ alert_type: '', severity: '', username: '' });
      fetchAlerts();
      fetchIncidentsAndAnalyze();
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await axios.put(`${API_URL}/api/alerts/${id}`, { status: newStatus });
      fetchAlerts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCheckIP = async (ip) => {
    if (!ip) return;
    setIpIntel(prev => ({ ...prev, [ip]: { message: 'Checking...' } }));
    try {
      const res = await axios.post(`${API_URL}/api/threat-intel`, { ip });
      setIpIntel(prev => ({ ...prev, [ip]: res.data.result }));
    } catch (err) {
      setIpIntel(prev => ({ ...prev, [ip]: { message: 'Error checking IP' } }));
    }
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatQuestion.trim()) return;
    
    setChatLoading(true);
    setChatAnswer('');
    try {
      const res = await axios.post(`${API_URL}/api/ai/chat`, { question: chatQuestion });
      setChatAnswer(res.data.answer);
    } catch (err) {
      setChatAnswer("Sorry, I couldn't process that request. Check if the backend is running.");
    }
    setChatLoading(false);
  };

  const downloadPDF = () => {
    const input = document.getElementById('dashboard-content');
    html2canvas(input, { scale: 2 }).then((canvas) => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('AI-SOC-Report.pdf');
    });
  };

  // Derived Data
  const criticalCount = alerts.filter(a => a.severity === 'CRITICAL').length;
  const highCount = alerts.filter(a => a.severity === 'HIGH').length;
  const mediumCount = alerts.filter(a => a.severity === 'MEDIUM').length;
  const lowCount = alerts.filter(a => a.severity === 'LOW').length;

  const chartData = [
    { name: 'Critical', value: criticalCount, color: '#d32f2f' },
    { name: 'High', value: highCount, color: '#f57c00' },
    { name: 'Medium', value: mediumCount, color: '#fbc02d' },
    { name: 'Low', value: lowCount, color: '#388e3c' },
  ].filter(d => d.value > 0);

  const filteredAlerts = alerts.filter(a => 
    (a.username && a.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (a.alert_type && a.alert_type.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div style={{ padding: '24px', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <div id="dashboard-content" style={{ padding: '20px', backgroundColor: 'white' }}>
        
        {/* HEADER & PDF */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>AI-SOC Dashboard</h1>
          <button onClick={downloadPDF} style={{ padding: '10px 20px', backgroundColor: '#d32f2f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            📄 Download PDF Report
          </button>
        </div>

        {/* AI CHAT */}
        <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#e3f2fd', borderRadius: '8px', border: '1px solid #90caf9' }}>
          <h3 style={{ marginTop: 0, color: '#1565c0' }}>💬 Ask the AI SOC Analyst</h3>
          <form onSubmit={handleChatSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <input 
              type="text" 
              value={chatQuestion}
              onChange={(e) => setChatQuestion(e.target.value)}
              placeholder="e.g., What happened to employee3? Summarize the critical alerts."
              style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #90caf9' }}
            />
            <button type="submit" disabled={chatLoading} style={{ padding: '10px 20px', backgroundColor: '#1565c0', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              {chatLoading ? 'Thinking...' : 'Ask AI'}
            </button>
          </form>
          
          {chatAnswer && (
            <div style={{ padding: '15px', backgroundColor: 'white', borderRadius: '4px', borderLeft: '4px solid #1565c0' }}>
              <strong>🤖 AI Response:</strong>
              <p style={{ margin: '10px 0 0 0', lineHeight: '1.5' }}>{chatAnswer}</p>
            </div>
          )}
        </div>

                {/* ADD ALERT FORM */}
        <div style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', backgroundColor: '#fafafa' }}>
          <h3 style={{ marginTop: 0 }}>➕ Add New Security Alert</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input 
              placeholder="Alert Type (e.g., Failed Login)" 
              value={form.alert_type} 
              onChange={(e) => setForm({ ...form, alert_type: e.target.value })} 
              required 
              style={{ padding: '10px', flex: '1 1 200px', borderRadius: '4px', border: '1px solid #ccc' }} 
            />
            <select 
              value={form.severity} 
              onChange={(e) => setForm({ ...form, severity: e.target.value })} 
              required 
              style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="">Select Severity</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
            <input 
              placeholder="Username (e.g., employee3)" 
              value={form.username} 
              onChange={(e) => setForm({ ...form, username: e.target.value })} 
              style={{ padding: '10px', flex: '1 1 150px', borderRadius: '4px', border: '1px solid #ccc' }} 
            />
            <input 
              placeholder="Source IP (optional)" 
              value={form.source_ip} 
              onChange={(e) => setForm({ ...form, source_ip: e.target.value })} 
              style={{ padding: '10px', flex: '1 1 150px', borderRadius: '4px', border: '1px solid #ccc' }} 
            />
            <button type="submit" style={{ padding: '10px 20px', cursor: 'pointer', backgroundColor: '#1976d2', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
              Add Alert
            </button>
          </form>
        </div>

        {/* STAT CARDS */}
        <div style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
          <div style={{ flex: 1, padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '8px', textAlign: 'center' }}>
            <h3 style={{ margin: 0, color: '#555' }}>Total Alerts</h3>
            <h1 style={{ margin: '10px 0 0 0' }}>{alerts.length}</h1>
          </div>
          <div style={{ flex: 1, padding: '20px', backgroundColor: '#ffebee', borderRadius: '8px', textAlign: 'center', border: '1px solid #ffcdd2' }}>
            <h3 style={{ margin: 0, color: '#c62828' }}>Critical</h3>
            <h1 style={{ margin: '10px 0 0 0', color: '#c62828' }}>{criticalCount}</h1>
          </div>
          <div style={{ flex: 1, padding: '20px', backgroundColor: '#fff3e0', borderRadius: '8px', textAlign: 'center', border: '1px solid #ffe0b2' }}>
            <h3 style={{ margin: 0, color: '#e65100' }}>High</h3>
            <h1 style={{ margin: '10px 0 0 0', color: '#e65100' }}>{highCount}</h1>
          </div>
          <div style={{ flex: 1, padding: '20px', backgroundColor: '#e8f5e9', borderRadius: '8px', textAlign: 'center', border: '1px solid #c8e6c9' }}>
            <h3 style={{ margin: 0, color: '#2e7d32' }}>Medium / Low</h3>
            <h1 style={{ margin: '10px 0 0 0', color: '#2e7d32' }}>{mediumCount + lowCount}</h1>
          </div>
        </div>

        {/* CHART */}
        {chartData.length > 0 && (
          <div style={{ marginBottom: '40px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '400px', height: '300px' }}>
              <h3 style={{ textAlign: 'center', marginTop: 0 }}>Alert Severity Distribution</h3>
              <PieChart width={400} height={250}>
                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </div>
          </div>
        )}

        {/* INCIDENTS & AI */}
        <div style={{ marginBottom: '40px' }}>
          <h2>Detected Incidents & AI Analysis</h2>
          {loadingAi && <p>🧠 Gemini is analyzing the incidents...</p>}
          
          {incidents.map((incident) => {
            const ai = aiAnalysis[incident.username];
            return (
              <div key={incident.username} style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <h3 style={{ color: '#d32f2f', marginTop: 0 }}>🚨 {incident.type} - {incident.username}</h3>
                
                {ai ? (
                  <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '4px', border: '1px solid #e9ecef' }}>
                    <h4 style={{ marginTop: 0, color: '#1976d2' }}>🤖 AI Analysis: {ai.title}</h4>
                    <p><strong>MITRE ATT&CK:</strong> <span style={{ backgroundColor: '#eee', padding: '2px 6px', borderRadius: '4px', fontSize: '0.9em' }}>{ai.mitreId || 'N/A'}</span></p>
                    <p><strong>Attack Pattern:</strong> {ai.attackPattern}</p>
                    <p><strong>Risk Level:</strong> <span style={{ color: ai.riskLevel === 'CRITICAL' ? '#d32f2f' : '#f57c00', fontWeight: 'bold' }}>{ai.riskLevel}</span></p>
                    <p><strong>Analyst Summary:</strong> {ai.analystSummary}</p>
                    <div>
                      <strong>Recommended Response:</strong>
                      <ul>
                        {ai.recommendedResponse.map((action, idx) => <li key={idx}>{action}</li>)}
                      </ul>
                    </div>
                  </div>
                ) : <p>Waiting for AI analysis...</p>}
              </div>
            );
          })}
        </div>

        {/* SEARCH & TABLE */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>All Security Alerts</h2>
          <input 
            type="text" 
            placeholder="🔍 Search by username or type..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ padding: '10px', width: '300px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>
        
        <table border="1" cellPadding="10" style={{ borderCollapse: 'collapse', width: '100%', textAlign: 'left', marginTop: '10px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f0f0f0' }}>
              <th>Type</th>
              <th>Severity</th>
              <th>Username</th>
              <th>Source IP</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredAlerts.map((a) => (
              <tr key={a.id}>
                <td>{a.alert_type}</td>
                <td style={{ color: a.severity === 'CRITICAL' ? '#d32f2f' : a.severity === 'HIGH' ? '#f57c00' : 'black', fontWeight: 'bold' }}>
                  {a.severity}
                </td>
                <td>{a.username}</td>
                <td>
                  {a.source_ip ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <span>{a.source_ip}</span>
                      {ipIntel[a.source_ip] ? (
                        <span style={{ fontSize: '0.8em', color: ipIntel[a.source_ip].isMalicious ? '#d32f2f' : '#2e7d32', fontWeight: 'bold' }}>
                          {ipIntel[a.source_ip].isMalicious ? '⚠️ ' : '✅ '} 
                          {ipIntel[a.source_ip].message}
                        </span>
                      ) : (
                        <button onClick={() => handleCheckIP(a.source_ip)} style={{ fontSize: '0.8em', padding: '2px 8px', cursor: 'pointer' }}>
                          Check IP
                        </button>
                      )}
                    </div>
                  ) : '-'}
                </td>
                <td>
                  <select value={a.status} onChange={(e) => handleStatusChange(a.id, e.target.value)} style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }}>
                    <option value="OPEN">OPEN</option>
                    <option value="INVESTIGATING">INVESTIGATING</option>
                    <option value="RESOLVED">RESOLVED</option>
                  </select>
                </td>
              </tr>
            ))}
            {filteredAlerts.length === 0 && (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>No alerts found matching your search.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;