// Mocks de red compartidos por los tests e2e — nada de credenciales reales
// de Google en ningún test.
//
// Estrategia para Sheets: en vez de simular a mano cada endpoint exacto que
// usa cada módulo, la respuesta de metadata (GET .../spreadsheets/{id}) ya
// declara creadas TODAS las pestañas que cualquier init*Sheet() del código
// busca (ver provisionAllTabs en bases.js) — así ningún módulo intenta crear
// nada al conectar, y alcanza con responder los GET de /values/... (vacíos,
// salvo "Bases", que necesita una fila real para que la app auto-conecte en
// vez de mostrar el selector de bases).

export const ALL_TABS = [
  'Bases', 'Config', 'Stories', 'IdeasMarketing', 'KanbanTasks', 'KanbanConfig', 'GanttProjects',
  'TareasHistorial', 'RecetasPlantillas', 'RecetaBlocks', 'RecetasEjecuciones', 'Ingredientes',
  'Compras', 'Ferias', 'CanalesVenta', 'StockTestigo', 'StockMovimientos', 'QR', 'Ideas',
  'Contactos', 'ContactosRelaciones'
];

const ALL_MODULE_KEYS = ['contenido', 'tareas', 'procesos', 'compras', 'ferias', 'stock', 'informes', 'qr', 'contactos'];

// Deja `window.google.accounts.oauth2` definido antes de que main.js lo
// consulte (main.js hace polling de window.google?.accounts?.oauth2 antes de
// llamar a initAuth) — sin esto la app se queda esperando para siempre.
// requestAccessToken/requestCode fallan a propósito ('not_mocked'): estos
// tests parten de una sesión ya guardada en localStorage, nunca ejercitan el
// popup real de Google.
export async function mockGoogleIdentity(page) {
  await page.route('https://accounts.google.com/gsi/client**', route => route.fulfill({
    contentType: 'text/javascript',
    body: `
      window.google = window.google || {};
      window.google.accounts = window.google.accounts || {};
      window.google.accounts.oauth2 = {
        initTokenClient: (cfg) => ({ requestAccessToken: () => cfg.callback && cfg.callback({ error: 'not_mocked' }) }),
        initCodeClient:  (cfg) => ({ requestCode: () => cfg.callback && cfg.callback({ error: 'not_mocked' }) }),
        revoke: (token, cb) => { if (cb) cb(); }
      };
    `
  }));
}

// Con estado (por test, vive en el closure de cada llamada): un :append a una
// pestaña queda guardado en memoria y un GET posterior a esa misma pestaña lo
// devuelve — necesario para poder probar "crear algo y verlo aparecer en la
// lista" sin un backend de Sheets real. Las filas se guardan sin fila de
// encabezado (el código real la escribe una sola vez al crear la pestaña,
// algo que acá nunca pasa porque la metadata ya declara todo creado); se le
// antepone una fila vacía al responder porque todos los loaders del código
// descartan la primera fila (.slice(1)) o la ignoran si no tiene r[0].
export async function mockGoogleBackend(page) {
  const store = new Map();

  await page.route('https://www.googleapis.com/oauth2/v3/userinfo**', route => route.fulfill({
    json: { name: 'Test User', email: 'test@example.com' }
  }));

  await page.route('https://sheets.googleapis.com/v4/spreadsheets/**', route => {
    const req    = route.request();
    const url    = new URL(req.url());
    const method = req.method();
    const tail   = url.pathname.split('/v4/spreadsheets/')[1] || '';
    const spreadsheetId = tail.split(/[/:]/)[0];
    const isMetadata    = tail === spreadsheetId;
    const isBatchUpdate = tail.endsWith(':batchUpdate');
    const valuesMatch   = tail.match(/\/values\/([^!]+)!/);
    const tabName       = valuesMatch ? valuesMatch[1] : null;

    if (method === 'GET' && isMetadata) {
      return route.fulfill({ json: { sheets: ALL_TABS.map((title, i) => ({ properties: { title, sheetId: i + 1 } })) } });
    }

    if (tabName && method === 'GET') {
      if (tabName === 'Bases' && !store.has('Bases')) {
        store.set('Bases', [['base-1', 'Test', spreadsheetId, ALL_MODULE_KEYS.join(','), new Date().toISOString()]]);
      }
      const rows = store.get(tabName) || [];
      return route.fulfill({ json: { values: rows.length ? [[], ...rows] : [] } });
    }

    if (tabName && tail.includes(':append')) {
      const body = req.postDataJSON();
      const existing = store.get(tabName) || [];
      store.set(tabName, existing.concat(body.values || []));
      return route.fulfill({ json: {} });
    }

    if (tabName) return route.fulfill({ json: {} }); // PUT de valores (ediciones) — no usado por estos tests
    if (isBatchUpdate) return route.fulfill({ json: { replies: [{ addSheet: { properties: { sheetId: 999 } } }] } });

    return route.fulfill({ json: {} });
  });
}

// Mock de subida/borrado/reproducción de Drive — no existía ningún test que
// ejercitara uploadToDrive/deleteDriveFile/streamDriveFile antes de Ideas de
// marketing (el primer feature que sube fotos Y audio en el mismo flujo).
// Reutilizable para cualquier test futuro que necesite simular archivos.
export async function mockDriveUpload(page) {
  let fileCounter = 0;

  await page.route('https://www.googleapis.com/upload/drive/v3/files**', route => {
    const req = route.request();
    if (req.method() === 'POST') {
      // Init de la subida resumable: responde con la URL a la que el cliente
      // hace el PUT real (mismo host, así el segundo route la intercepta).
      // Access-Control-Expose-Headers es necesario porque esto es cross-origin
      // (localhost -> googleapis.com) — sin él, fetch() no deja leer Location
      // aunque el header esté en la respuesta (mismo motivo por el que la API
      // real de Drive también lo expone).
      return route.fulfill({
        status: 200,
        headers: {
          Location: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=fake-upload',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'Location'
        },
        body: ''
      });
    }
    fileCounter++;
    return route.fulfill({
      headers: { 'Access-Control-Allow-Origin': '*' },
      json: { id: `fake-file-id-${fileCounter}` }
    });
  });

  await page.route('https://www.googleapis.com/drive/v3/files/*/permissions', route =>
    route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, json: {} })
  );

  await page.route('https://www.googleapis.com/drive/v3/files/*?alt=media', route =>
    route.fulfill({
      status: 200, contentType: 'audio/webm',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: Buffer.from([0, 0, 0, 0])
    })
  );

  await page.route(/https:\/\/www\.googleapis\.com\/drive\/v3\/files\/[^/]+$/, route => {
    if (route.request().method() === 'DELETE')
      return route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, json: {} });
    return route.fallback();
  });
}

// Deja el token guardado como si ya hubiera pasado el login (loadSavedToken
// en auth.js lo encuentra y evita mostrar la pantalla de login por completo).
export async function seedValidSession(page) {
  await page.addInitScript(() => {
    localStorage.setItem('ss_token', 'fake-access-token');
    localStorage.setItem('ss_tokenExpiry', String(Date.now() + 60 * 60 * 1000));
    localStorage.setItem('ss_userInfo', JSON.stringify({ name: 'Test User', email: 'test@example.com' }));
  });
}

export async function gotoApp(page) {
  await mockGoogleIdentity(page);
  await mockGoogleBackend(page);
  await seedValidSession(page);
  await page.goto('/');
  await page.locator('#screenApp').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#viewHome').waitFor({ state: 'visible' });
}
