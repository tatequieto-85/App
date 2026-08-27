import { test, expect } from '@playwright/test';
import { gotoApp } from './mocks.mjs';

test('entra directo a Home con una sesión ya guardada, sin pantalla de login', async ({ page }) => {
  await gotoApp(page);
  await expect(page.locator('#screenSignIn')).toBeHidden();
  await expect(page.locator('#viewHome')).toBeVisible();
});

test('navegar a un módulo y volver con el botón atrás del navegador', async ({ page }) => {
  await gotoApp(page);

  await page.locator('[data-nav="compras"]').click();
  await expect(page.locator('#viewCompras')).toBeVisible();
  expect(page.url()).toContain('#compras');

  await page.goBack();
  await expect(page.locator('#viewHome')).toBeVisible();
  await expect(page.locator('#viewCompras')).toBeHidden();
});

test('Ctrl+K abre la paleta de comandos, filtra y navega', async ({ page }) => {
  await gotoApp(page);

  await page.keyboard.press('Control+k');
  await expect(page.locator('#commandPaletteOverlay')).toHaveClass(/open/);

  await page.locator('#commandPaletteInput').fill('ventas');
  await page.locator('.command-palette-item', { hasText: 'Ventas' }).first().click();

  await expect(page.locator('#viewFerias')).toBeVisible();
  await expect(page.locator('#commandPaletteOverlay')).not.toHaveClass(/open/);
});

test('Tareas conserva la sub-pestaña activa al volver de Home', async ({ page }) => {
  await gotoApp(page);

  await page.locator('[data-nav="tareas"]').click();
  await expect(page.locator('#viewTareas')).toBeVisible();

  await page.locator('.sub-tab-btn[data-subtab="gantt"]').click();
  await expect(page.locator('#subTabGantt')).toBeVisible();

  await page.locator('#headerLogoBtn').click();
  await expect(page.locator('#viewHome')).toBeVisible();

  await page.locator('[data-nav="tareas"]').click();
  await expect(page.locator('#subTabGantt')).toBeVisible();
  await expect(page.locator('#subTabKanban')).toBeHidden();
});
