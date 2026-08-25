// Carga sw.js en un sandbox mínimo de Node (sin navegador) y verifica su
// estrategia real de fetch. No usa Playwright: con el Service Worker activo,
// page.route() no intercepta lo que el propio SW pide desde su contexto, así
// que esto es lo único que puede probar el fetch handler de verdad.
//
// La regla que estos tests protegen: cualquier dominio externo (Sheets,
// Drive, y ahora el Worker de sesión de auth.js) debe ir SIEMPRE directo a
// la red, nunca pasar por caches.match/cache.put — si alguien "simplifica"
// sw.js sacando el chequeo de origin, la respuesta de un access_token
// quedaría cacheada para siempre y ninguna renovación futura tocaría la red
// de verdad (ver el comentario en sw.js junto al fetch handler).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const swSource = fs.readFileSync(path.join(__dirname, '..', '..', 'sw.js'), 'utf8');

function loadSw({ cachedResponse } = {}) {
  const listeners = {};
  const fetchCalls = [];
  const cacheMatchCalls = [];

  const fakeCache = {
    match: async () => cachedResponse,
    put: async () => {},
    addAll: async () => {}
  };

  const sandbox = {
    self: {
      location: { origin: 'https://tatequieto-85.github.io' },
      addEventListener: (type, fn) => { listeners[type] = fn; },
      skipWaiting: () => {},
      clients: { claim: () => {} }
    },
    caches: {
      open: async () => fakeCache,
      match: async (req) => { cacheMatchCalls.push(req.url); return fakeCache.match(req); },
      keys: async () => []
    },
    fetch: async (req) => {
      const url = typeof req === 'string' ? req : req.url;
      fetchCalls.push(url);
      return { ok: true, url };
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(swSource, sandbox, { filename: 'sw.js' });

  return { listeners, fetchCalls, cacheMatchCalls };
}

function fireFetch(listeners, url, method = 'GET') {
  let responded;
  listeners.fetch({
    request: { url, method },
    respondWith(p) { responded = p; }
  });
  return responded; // undefined si el handler no interceptó este request
}

test('el dominio del Worker de sesión nunca pasa por caches.match', async () => {
  const { listeners, cacheMatchCalls } = loadSw();
  await fireFetch(listeners, 'https://tateapp-token.example.workers.dev/token?session=abc');
  assert.equal(cacheMatchCalls.length, 0);
});

test('el handler no intercepta pedidos al Worker: nunca llama respondWith, así que SIEMPRE llegan a la red real del navegador, sin importar cuántas veces se repita la misma URL', async () => {
  const { listeners, fetchCalls } = loadSw();
  const url = 'https://tateapp-token.example.workers.dev/token?session=abc';
  const r1 = fireFetch(listeners, url);
  const r2 = fireFetch(listeners, url);
  assert.equal(r1, undefined);
  assert.equal(r2, undefined);
  // El propio SW tampoco llama a fetch() acá: al no interceptar, es el
  // navegador el que hace el pedido por su cuenta, fuera de este handler.
  assert.equal(fetchCalls.length, 0);
});

test('Sheets/Drive tampoco se cachean (mismo criterio, sin regresión)', async () => {
  const { listeners, cacheMatchCalls } = loadSw();
  await fireFetch(listeners, 'https://sheets.googleapis.com/v4/spreadsheets/xyz/values/A1');
  await fireFetch(listeners, 'https://www.googleapis.com/drive/v3/files/abc');
  assert.equal(cacheMatchCalls.length, 0);
});

test('los assets propios de la app siguen siendo cache-first (sin regresión)', async () => {
  const cachedResponse = { fromCache: true };
  const { listeners, cacheMatchCalls } = loadSw({ cachedResponse });
  const result = await fireFetch(listeners, 'https://tatequieto-85.github.io/App/main.js');
  assert.equal(cacheMatchCalls.length, 1);
  assert.equal(result, cachedResponse);
});

test('un POST nunca se intercepta, ni siquiera same-origin', async () => {
  const { listeners } = loadSw();
  const result = fireFetch(listeners, 'https://tatequieto-85.github.io/App/main.js', 'POST');
  assert.equal(result, undefined);
});
