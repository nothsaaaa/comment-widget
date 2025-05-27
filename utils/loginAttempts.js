const loginAttempts = new Map();

function getLoginKey(ip, sectionId) {
  return `${ip}-${sectionId}`;
}

export function recordFailedAttempt(ip, sectionId) {
  const key = getLoginKey(ip, sectionId);
  const now = Date.now();
  const attempts = loginAttempts.get(key) || [];

  const recent = attempts.filter(t => now - t < 60 * 60 * 1000);
  recent.push(now);
  loginAttempts.set(key, recent);
}

export function isBlocked(ip, sectionId) {
  const key = getLoginKey(ip, sectionId);
  const attempts = loginAttempts.get(key) || [];
  const now = Date.now();
  const recent = attempts.filter(t => now - t < 60 * 60 * 1000);
  return recent.length >= 8;
}
