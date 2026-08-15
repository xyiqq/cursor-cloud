/* Shared showroom hub client helpers */
(function (global) {
  function qs(name) {
    return new URLSearchParams(location.search).get(name);
  }

  function authHeaders(extra) {
    const key = qs('key') || localStorage.getItem('showroomKey') || '';
    const h = Object.assign({ Accept: 'application/json' }, extra || {});
    if (key) h['X-Showroom-Key'] = key;
    return h;
  }

  function withKey(url) {
    const key = qs('key') || localStorage.getItem('showroomKey') || '';
    if (!key) return url;
    const u = new URL(url, location.origin);
    if (!u.searchParams.get('key')) u.searchParams.set('key', key);
    return u.pathname + u.search;
  }

  async function api(path, opts) {
    opts = opts || {};
    const headers = authHeaders(opts.headers);
    if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    const res = await fetch(withKey(path), Object.assign({}, opts, { headers }));
    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    if (!res.ok) throw new Error((json && json.error) || text || res.statusText);
    return json;
  }

  function connectSSE(onEvent) {
    const es = new EventSource(withKey('/api/stream'));
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === 'hello' && Array.isArray(data.recent)) {
          data.recent.forEach(onEvent);
          return;
        }
        onEvent(data);
      } catch {
        /* ignore */
      }
    };
    return es;
  }

  function fmtTime(ts) {
    try {
      return new Date(ts || Date.now()).toLocaleTimeString();
    } catch {
      return '';
    }
  }

  global.Showroom = { api, connectSSE, fmtTime, withKey, qs };
})(window);
