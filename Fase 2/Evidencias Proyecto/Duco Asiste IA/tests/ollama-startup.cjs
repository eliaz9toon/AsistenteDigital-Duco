const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

function createClient(fetch, options = {}) {
  const window = {
    location: { hostname: '127.0.0.1', origin: 'http://127.0.0.1:5500' },
    ducoConfig: { knowledgeApiBaseUrl: 'http://127.0.0.1:8765', ...options }
  };
  vm.runInNewContext(fs.readFileSync('js/ollama-client.js', 'utf8'), {
    window, fetch, console, AbortController, URL, setTimeout, clearTimeout
  });
  return window.ducoAI;
}

(async () => {
  let running = false;
  let starts = 0;
  let probes = 0;
  const client = createClient(async (url, options) => {
    if (url.endsWith('/api/tags')) {
      probes++;
      if (!running) throw new Error('offline');
      return { ok: true };
    }
    assert.equal(url, 'http://127.0.0.1:8765/api/duco/ollama/ensure');
    assert.equal(options.method, 'POST');
    starts++;
    running = true;
    return { ok: true, json: async () => ({ online: true }) };
  });
  assert.deepEqual(await Promise.all([client.isServerOnline(), client.isServerOnline()]), [true, true]);
  assert.equal(starts, 1, 'Simultaneous checks must share startup');
  assert.equal(probes, 2, 'Verify the server after starting it');
  running = false;
  assert.equal(await client.isServerOnline(), true);
  assert.equal(starts, 2, 'Restart when Ollama stops during use');

  let requests = 0;
  const unavailable = createClient(async () => { requests++; throw new Error('offline'); });
  assert.equal(await unavailable.isServerOnline(), false);
  assert.equal(await unavailable.isServerOnline(), false);
  assert.equal(requests, 4, 'Failed startup must not be cached forever');

  const remote = createClient(async url => {
    assert.equal(url, 'http://example.com:11434/api/tags');
    throw new Error('offline');
  }, { ollamaBaseUrl: 'http://example.com:11434' });
  assert.equal(await remote.isServerOnline(), false, 'Remote Ollama must not start a local process');
  console.log('OK: automatic startup, concurrent checks, restart, unavailable backend and remote Ollama.');
})().catch(error => { console.error(error); process.exitCode = 1; });
