import { test, expect } from '@playwright/test';
import { gotoApp } from './mocks.mjs';

test('crear una tarea nueva desde Tareas la agrega al tablero Kanban', async ({ page }) => {
  await gotoApp(page);

  await page.keyboard.press('Control+k');
  await page.locator('#commandPaletteInput').fill('nueva tarea');
  await page.locator('.command-palette-item', { hasText: 'Nueva tarea' }).first().click();

  await expect(page.locator('#taskOverlay')).toHaveClass(/open/);
  await page.locator('#taskTitle').fill('Tarea de prueba e2e');
  await page.locator('#btnSaveTask').click();

  await expect(page.locator('#taskOverlay')).not.toHaveClass(/open/);
  await expect(page.locator('#kanbanBoard')).toContainText('Tarea de prueba e2e');
});
