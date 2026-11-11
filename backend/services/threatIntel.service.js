const axios = require('axios');

async function checkIPReputation(ip) {
  // Skip checking private/local IPs (they aren't on the public internet)
  if (!ip || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('127.')) {
    return { score: 0, isMalicious: false, message: 'Private/Local IP (Safe)' };
  }

  try {
    const response = await axios.get('https://api.abuseipdb.com/api/v2/check', {
      params: { ipAddress: ip, maxAgeInDays: 90 },
      headers: {
        'Key': process.env.ABUSEIPDB_API_KEY,
        'Accept': 'application/json'
      }
    });

    const data = response.data.data;
    const score = data.abuseConfidenceScore;
    return {
      score: score,
      isMalicious: score > 50, // If abuse score > 50%, flag as malicious
      message: `Abuse Score: ${score}% (${data.totalReports} reports)`
    };
  } catch (err) {
    console.error('Threat Intel error:', err.message);
    return { score: 0, isMalicious: false, message: 'Could not fetch intel' };
  }
}

module.exports = { checkIPReputation };