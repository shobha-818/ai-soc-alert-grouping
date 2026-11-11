function correlateAlerts(alerts) {
  const byUser = {};
  
  // 1. Group alerts by username (converted to lowercase so "Employee3" and "employee3" match)
  alerts.forEach(a => {
    if (!a.username) return;
    const user = a.username.trim().toLowerCase();
    if (!byUser[user]) byUser[user] = [];
    // Convert alert type to lowercase so "Failed login" matches "Failed Login"
    byUser[user].push(a.alert_type.trim().toLowerCase());
  });
  
  const incidents = [];
  
  // 2. Check for patterns
  for (const [username, types] of Object.entries(byUser)) {
    const failedLogins = types.filter(t => t === 'failed login').length;
    // We allow "successful login" and "successfull login" (with two l's) just in case
    const hasSuccess = types.some(t => t === 'successful login' || t === 'successfull login');
    const hasFileAccess = types.includes('sensitive file access');
    
    // Account Compromise Pattern
    if (failedLogins >= 2 && hasSuccess && hasFileAccess) {
      incidents.push({
        username: username,
        type: 'Possible Account Compromise',
        severity: 'HIGH',
        reason: `${failedLogins} failed logins followed by successful login and sensitive file access`
      });
    }
    
    // Malware Infection Pattern
    const hasMalware = types.includes('malware detection');
    const hasSuspicious = types.includes('suspicious process');
    const hasOutbound = types.includes('outbound connection');
    
    if (hasMalware && hasSuspicious && hasOutbound) {
      incidents.push({
        username: username,
        type: 'Possible Malware Infection',
        severity: 'CRITICAL',
        reason: 'Malware detected with suspicious process and outbound connection'
      });
    }
  }
  
  return incidents;
}

module.exports = { correlateAlerts };