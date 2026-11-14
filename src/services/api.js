const API_BASE = '/api';

export async function apiRequest(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
  });

  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    let errPayload = null;
    if (contentType.includes('application/json')) {
      errPayload = await res.json().catch(() => null);
    } else {
      const txt = await res.text().catch(() => '');
      errPayload = { error: txt || `Request failed with HTTP ${res.status}` };
    }
    const err = new Error(errPayload?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.payload = errPayload;
    throw err;
  }

  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res;
}

export const modelApi = {
  getMetrics: () => apiRequest('/model/metrics'),
  getRules: () => apiRequest('/model/rules'),
  getHealth: () => apiRequest('/health'),
};
