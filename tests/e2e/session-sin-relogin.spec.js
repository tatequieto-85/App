// Prueba el objetivo central de la Fase 1: con un sessionToken guardado (el
// JWT que ahora emite el Worker de Cloudflare, ver worker/src/index.js), la
// app debe renovarse sola sin mostrar la pantalla de login — y si el Worker
// no puede renovar, debe mostrar el login normal en vez de quedar a medias
// (ese "a medias" fue justo el bug real de Google One Tap descrito en la
// sección 11 de ARQUITECTURA.txt: mismo principio, distinta causa acá).

import { test, expect } from '@playwright/test';
import { mockGoogleIdentity, mockGoogleBackend } from './mocks.mjs';

const FAKE_WORKER = 'https://tateapp-token.test';

// Sirve un config.js propio con WORKER_URL apuntando al Worker falso de este
// test, en vez de depender del config.js real (que hoy tiene WORKER_URL
// vacío hasta que se despliegue — ver worker/README.md).
async function mockConfigWithWorker(page) {
  await page.route('**/config.js', route => route.fulfill({
    contentType: 'text/javascript',
    body: `
      const CONFIG = {
        CLIENT_ID: 'test-client-id',
        SHEET_ID: 'test-sheet-id',
        SCOPES: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
        WORKER_URL: '${FAKE_WORKER}'
      };
    `
  }));
}

test('con sessionToken guardado y el Worker respondiendo bien, entra sin mostrar la pantalla de login', async ({ page }) => {
  await mockConfigWithWorker(page);
  await mockGoogleIdentity(page);
  await mockGoogleBackend(page);

  await page.route(`${FAKE_WORKER}/token**`, route => route.fulfill({
    json: { access_token: 'fresh-access-token', expires_in: 3600 }
  }));

  // Sin ss_token/ss_tokenExpiry: obliga a pasar por trySilentGoogleAuth (el
  // camino que en producción usa el Worker) en vez del atajo de token ya
  // guardado y vigente.
  await page.addInitScript(() => {
    localStorage.setItem('ss_sessionToken', 'fake.session.token');
  });

  await page.goto('/');
  await expect(page.locator('#screenSignIn')).toBeHidden();
  await expect(page.locator('#viewHome')).toBeVisible({ timeout: 15000 });
});

test('si el Worker no puede renovar, muestra la pantalla de login normal (no deja la app a medias)', async ({ page }) => {
  await mockConfigWithWorker(page);
  await mockGoogleIdentity(page);
  await mockGoogleBackend(page);

  await page.route(`${FAKE_WORKER}/token**`, route => route.fulfill({
    status: 401,
    json: { error: 'invalid_session' }
  }));

  await page.addInitScript(() => {
    localStorage.setItem('ss_sessionToken', 'fake.session.token');
  });

  await page.goto('/');
  await expect(page.locator('#screenSignIn')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#screenApp')).toBeHidden();
});
