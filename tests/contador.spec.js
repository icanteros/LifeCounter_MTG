// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

// Ruta al archivo HTML local
const HTML_PATH = 'file:///' + path.resolve(__dirname, '../contador_mtg.html').replace(/\\/g, '/');

test.beforeEach(async ({ page }) => {
  await page.goto(HTML_PATH);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(HTML_PATH); // Doble carga para asegurar estado limpio
});

test.describe('MTG Life Counter – Estructura inicial', () => {

  test('Se cargan 4 jugadores con vida inicial 40', async ({ page }) => {

    for (let i = 1; i <= 4; i++) {
      const lifeEl = page.locator(`#life-${i}`);
      await expect(lifeEl).toContainText('40');
    }
  });

  test('Los nombres por defecto son "Jugador 1" a "Jugador 4"', async ({ page }) => {
    // [x] Fase 2: Funcionalidades Avanzadas [x]
    // - [x] Implementar Historial de Cambios (Log)
    // - [x] Implementar Contador de Maná (Mana Pool)
    // - [x] Implementar Daño de Comandante Detallado (por oponente) + Tax
    // - [x] Implementar Temas Visuales (Personalización de color)
    // - [x] Actualizar persistencia y tests para Fase 2

    for (let i = 1; i <= 4; i++) {
      const nameInput = page.locator(`#player-${i} .player-name`);
      await expect(nameInput).toHaveValue(`Jugador ${i}`);
    }
  });

  test('Los contadores de Tax y comandante inician en 0', async ({ page }) => {

    for (let i = 1; i <= 4; i++) {
      await expect(page.locator(`#tax-${i}`)).toHaveText('0');
      // Ahora el comandante es un detalle, verificamos que el botón de detalles exista
      await expect(page.locator(`button.cmdr-adv-btn[data-pid="${i}"]`)).toBeVisible();
    }
  });

});

test.describe('MTG Life Counter – Botones de vida', () => {

  test('Botón +1 incrementa la vida del jugador', async ({ page }) => {

    // Clic en +1 del jugador 1
    await page.locator(`button.btn-main[data-pid="1"][data-delta="+1"]`).click();
    await expect(page.locator('#life-1')).toContainText('41');
  });

  test('Botón −1 reduce la vida del jugador', async ({ page }) => {

    await page.locator(`button.btn-main[data-pid="2"][data-delta="-1"]`).click();
    await expect(page.locator('#life-2')).toContainText('39');
  });

  test('Botón +5 incrementa la vida en 5', async ({ page }) => {

    await page.locator(`button.btn-fast[data-pid="3"][data-delta="+5"]`).click();
    await expect(page.locator('#life-3')).toContainText('45');
  });

  test('Botón −5 reduce la vida en 5', async ({ page }) => {

    await page.locator(`button.btn-fast[data-pid="4"][data-delta="-5"]`).click();
    await expect(page.locator('#life-4')).toContainText('35');
  });

  test('La vida puede acumularse con múltiples clics', async ({ page }) => {

    const btn = page.locator(`button.btn-main[data-pid="1"][data-delta="-1"]`);
    // Hacer clic 10 veces → vida debería ser 30
    for (let i = 0; i < 10; i++) {
      await btn.click();
    }
    await expect(page.locator('#life-1')).toContainText('30');
  });

});

test.describe('MTG Life Counter – Modo peligro (danger)', () => {

  test('Se activa la clase danger cuando la vida llega a 5 o menos', async ({ page }) => {

    // Restar 35 veces para llegar a 5
    const btn = page.locator(`button.btn-fast[data-pid="1"][data-delta="-5"]`);
    for (let i = 0; i < 7; i++) {
      await btn.click(); // -5 × 7 = -35 → vida = 5
    }

    const card = page.locator('#player-1');
    await expect(card).toHaveClass(/danger/);
  });

  test('La clase danger desaparece cuando la vida sube a 6+', async ({ page }) => {

    // Bajar a 5
    const btnMinus = page.locator(`button.btn-fast[data-pid="1"][data-delta="-5"]`);
    for (let i = 0; i < 7; i++) {
      await btnMinus.click();
    }

    // Subir a 6
    await page.locator(`button.btn-main[data-pid="1"][data-delta="+1"]`).click();

    const card = page.locator('#player-1');
    await expect(card).not.toHaveClass(/danger/);
  });

});

test.describe('MTG Life Counter – Contadores mini (veneno y comandante)', () => {

  test.skip('El veneno se incrementa con su botón +', async ({ page }) => {

    await page.locator(`[data-pid="1"][data-type="poison"][data-delta="+1"]`).click();
    await expect(page.locator('#poison-1')).toHaveText('1');
  });

  test.skip('El veneno no baja de 0', async ({ page }) => {

    await page.locator(`[data-pid="2"][data-type="poison"][data-delta="-1"]`).click();
    await expect(page.locator('#poison-2')).toHaveText('0');
  });

  test.skip('Se activa poison-critical al llegar a 10 de veneno', async ({ page }) => {
    const btn = page.locator(`button.btn-mini[data-pid="1"][data-type="poison"][data-delta="+1"]`);
    for (let i = 0; i < 10; i++) await btn.click();
    await expect(page.locator('#poison-wrap-1')).toHaveClass(/poison-critical/);
  });

  test.skip('La etiqueta de veneno se puede personalizar', async ({ page }) => {

    const labelInput = page.locator('#poison-wrap-1 .mini-label-input');
    await labelInput.fill('Experiencia');
    await expect(labelInput).toHaveValue('Experiencia');
  });

  test('El contador de maná incrementa al hacer clic', async ({ page }) => {
    // Abrir el selector de maná primero
    await page.click('button.mana-selector-btn[data-pid="1"]');
    
    const manaBtn = page.locator('button.btn-mana.g[data-pid="1"]');
    await manaBtn.click();
    await expect(page.locator('#mana-1-g')).toHaveText('1');
  });

  test('Los nombres se sincronizan en el daño de comandante', async ({ page }) => {
    // Cambiar nombre de P2
    await page.locator('#player-2 .player-name').fill('Sauron');
    
    // Abrir detalles de P1 y verificar si ve a Sauron
    await page.click('button.cmdr-adv-btn[data-pid="1"]');
    await expect(page.locator('#cmdr-lbl-1-2')).toHaveText('VS Sauron');
  });

  test('El Comander Tax (muertes) se puede incrementar', async ({ page }) => {

    // Ahora está en la pantalla principal
    const taxPlus = page.locator('button[data-pid="1"][data-type="tax"][data-delta="+1"]');
    await taxPlus.click();
    await expect(page.locator('#tax-1')).toHaveText('1');
  });

});

test.describe('MTG Life Counter – Edición de nombres', () => {

  test('Se puede cambiar el nombre de un jugador', async ({ page }) => {

    const input = page.locator('#player-1 .player-name');
    await input.fill('Saruman');
    await expect(input).toHaveValue('Saruman');
  });

  test('El nombre acepta hasta 20 caracteres (maxlength)', async ({ page }) => {

    const input = page.locator('#player-2 .player-name');
    const maxAttr = await input.getAttribute('maxlength');
    expect(maxAttr).toBe('20');
  });

});

test.describe('MTG Life Counter – Reset', () => {

  test('El botón de reset abre el overlay de confirmación', async ({ page }) => {

    await page.click('#reset-btn');
    await expect(page.locator('#confirm-overlay')).toHaveClass(/show/);
  });

  test('Cancelar cierra el overlay sin reiniciar', async ({ page }) => {

    // Cambiar vida y luego cancelar reset
    await page.locator(`button.btn-fast[data-pid="1"][data-delta="+5"]`).click();
    await page.click('#reset-btn');
    await page.click('#confirm-no');

    await expect(page.locator('#confirm-overlay')).not.toHaveClass(/show/);
    await expect(page.locator('#life-1')).toContainText('45');
  });

  test('Confirmar reset restablece todas las vidas a 40', async ({ page }) => {

    // Modificar varios jugadores
    await page.locator(`button.btn-fast[data-pid="1"][data-delta="-5"]`).click();
    await page.locator(`button.btn-fast[data-pid="2"][data-delta="+5"]`).click();
    await page.locator(`[data-pid="1"][data-type="tax"][data-delta="+1"]`).click();

    // Confirmar reset
    await page.click('#reset-btn');
    await page.click('#confirm-yes');

    for (let i = 1; i <= 4; i++) {
      await expect(page.locator(`#life-${i}`)).toContainText('40');
      // Verificamos el tax en lugar del cmdr general
      await expect(page.locator(`#tax-${i}`)).toHaveText('0');
    }
  });

  test('Confirmar reset restaura los nombres originales', async ({ page }) => {

    await page.locator('#player-1 .player-name').fill('Gandalf');
    await page.click('#reset-btn');
    await page.click('#confirm-yes');

    await expect(page.locator('#player-1 .player-name')).toHaveValue('Jugador 1');
  });

  test('Clic fuera del confirm-box cierra el overlay', async ({ page }) => {

    await page.click('#reset-btn');
    // Clic en el overlay (fondo oscuro), no en la caja
    await page.locator('#confirm-overlay').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('#confirm-overlay')).not.toHaveClass(/show/);
  });

});

test.describe('MTG Life Counter – Persistencia', () => {

  test('Los cambios persisten tras recargar la página', async ({ page }) => {

    // Modificar datos
    await page.locator('#player-1 .player-name').fill('Aragorn');
    await page.locator('button.btn-main[data-pid="1"][data-delta="+1"]').click(); // 41
    await page.locator('button.btn-mini[data-pid="1"][data-type="tax"][data-delta="+1"]').click(); // 1

    // Recargar
    await page.reload();

    // Verificar que se mantienen
    await expect(page.locator('#player-1 .player-name')).toHaveValue('Aragorn');
    await expect(page.locator('#life-1')).toContainText('41');
    await expect(page.locator('#tax-1')).toHaveText('1');
  });

  test('El historial (Log) registra cambios de vida', async ({ page }) => {

    await page.locator('button.btn-main[data-pid="1"][data-delta="+1"]').click();
    
    await page.click('#toggle-log');
    const lastEntry = page.locator('.log-entry').first();
    await expect(lastEntry).toContainText('Vida');
  });

  test('Aparece el overlay de muerte al llegar a 0 vidas', async ({ page }) => {
    // Bajar vida a 0 (está en 40)
    const btn = page.locator('button.btn-fast[data-pid="1"][data-delta="-5"]');
    for (let i = 0; i < 8; i++) await btn.click();
    
    await expect(page.locator('#death-1')).toHaveClass(/show/);
    await expect(page.locator('#death-1 .death-text')).toHaveText('HAS MUERTO');
  });

  test('Aparece el overlay de muerte al recibir 21 de daño de comandante', async ({ page }) => {
    // Abrir detalles de P1 para ver daño de P2
    await page.click('button.cmdr-adv-btn[data-pid="1"]');
    const plus = page.locator('button[data-pid="1"][data-type="cmdrDmg"][data-target="2"][data-delta="+1"]');
    for (let i = 0; i < 21; i++) await plus.click();
    
    await expect(page.locator('#death-1')).toHaveClass(/show/);
  });

  test('El botón Reiniciar Jugador restaura la vida y oculta el overlay', async ({ page }) => {
    // Matar jugador 1
    const btn = page.locator('button.btn-fast[data-pid="1"][data-delta="-5"]');
    for (let i = 0; i < 8; i++) await btn.click();
    
    // Revivir
    await page.click('#death-1 .revive-btn');
    await expect(page.locator('#death-1')).not.toHaveClass(/show/);
    await expect(page.locator('#life-1')).toContainText('40');
  });

  test('El reset limpia también el localStorage (original)', async ({ page }) => {
    await page.goto(HTML_PATH);

    // Modificar y resetear
    await page.locator('#player-1 .player-name').fill('Legolas');
    await page.click('#reset-btn');
    await page.click('#confirm-yes');

    // Recargar para ver si el reset se guardó
    await page.reload();

    await expect(page.locator('#player-1 .player-name')).toHaveValue('Jugador 1');
  });

});
