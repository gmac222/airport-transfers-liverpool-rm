import { API_BASE } from './config';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export function login(username, password) {
  return request('/api/login', {
    method: 'POST',
    body: JSON.stringify({ username, password, portal: 'driver' })
  });
}

export function listBookings() {
  return request('/api/booking?action=list&view=driver', { method: 'POST' });
}

export function driverAction(ref, action, extra = {}) {
  return request('/api/driver-action', {
    method: 'POST',
    body: JSON.stringify({ ref, action, ...extra })
  });
}

export function sendSms(action, fields) {
  return request('/api/sms', {
    method: 'POST',
    body: JSON.stringify({ action, fields })
  });
}
