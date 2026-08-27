// Thin fetch wrapper. All calls go to our own backend — no third-party
// secrets ever live in this file or anywhere else under public/.
const API = (() => {
  function token() {
    return localStorage.getItem('gvs_token') || '';
  }

  const REQUEST_TIMEOUT_MS = 15000;

  async function request(path, opts = {}) {
    const headers = { 'content-type': 'application/json', ...(opts.headers || {}) };
    const t = token();
    if (t) headers.authorization = `Bearer ${t}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(path, { ...opts, headers, signal: controller.signal });
    } catch (e) {
      // A hung request (no response ever received) surfaces here as an
      // AbortError once the timeout fires — give it a clear, specific
      // message instead of leaving the caller with silent nothing.
      const err = new Error(e.name === 'AbortError' ? 'Request timed out. Please try again.' : 'Network error. Please check your connection.');
      err.network = true;
      throw err;
    } finally {
      clearTimeout(timer);
    }
    let data = null;
    try { data = await res.json(); } catch { /* empty body */ }
    if (res.status === 401 && t) {
      // Token missing/expired/invalid: drop the stale session so the UI
      // reflects logged-out state instead of silently failing every call.
      localStorage.removeItem('gvs_token');
      localStorage.removeItem('gvs_user');
    }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed (${res.status}).`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  return {
    get: (path) => request(path, { method: 'GET' }),
    post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body || {}) }),
    put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body || {}) }),
    del: (path) => request(path, { method: 'DELETE' }),
  };
})();
