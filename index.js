import { chromium } from 'playwright';
import { config } from './config.js';

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildMockedTime(tipo) {
  const now = new Date();
  const gtDate = new Date(now.toLocaleString('en-US', { timeZone: config.timezone }));
  const year = gtDate.getFullYear();
  const month = gtDate.getMonth() + 1;
  const day = gtDate.getDate();

  const rango = tipo === 'entrada' ? config.horarios.entrada : config.horarios.salida;
  const inicioMin = rango.horaInicio.hora * 60 + rango.horaInicio.minuto;
  const finMin = rango.horaFin.hora * 60 + rango.horaFin.minuto;
  const randomMin = randomInt(inicioMin, finMin);
  const hora = Math.floor(randomMin / 60);
  const minuto = randomMin % 60;
  const segundo = randomInt(0, 59);

  return { year, month, day, hora, minuto, segundo };
}

function getTodayStr() {
  const now = new Date();
  const gtDate = new Date(now.toLocaleString('en-US', { timeZone: config.timezone }));
  return `${gtDate.getDate()}/${gtDate.getMonth() + 1}/${gtDate.getFullYear()}`;
}

/**
 * Marca entrada o salida para un usuario usando Playwright
 */
async function marcarUsuario(browser, username, tipo) {
  const tipoNombre = tipo === 'entrada' ? 'ENTRADA' : 'SALIDA';
  const time = buildMockedTime(tipo);
  const fechaStr = `${time.year}-${time.month}-${time.day} ${time.hora}:${time.minuto}:${time.segundo}`;

  console.log(`\n  👤 Usuario: ${username}`);
  console.log(`  📅 Hora a registrar: ${fechaStr}`);

  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  // Track dialog messages para detectar errores
  let dialogMessage = '';
  page.on('dialog', async (dialog) => {
    dialogMessage = dialog.message();
    console.log(`  💬 Dialog: ${dialogMessage}`);
    // Solo aceptar confirms de sustitución, no alerts de error
    if (dialog.type() === 'confirm') {
      await dialog.accept();
    } else {
      await dialog.dismiss();
    }
  });

  try {
    // 1. Login
    await page.goto(`${config.baseUrl}/Account/Login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#txtUsername', { timeout: 10000 });
    await page.fill('#txtUsername', username);
    await page.fill('#txtPassword', config.password);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
      page.click('input[name="btnIniciarSesion"]'),
    ]);

    // Esperar un poco para que termine la navegación
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    if (currentUrl.includes('/Account/Login') || currentUrl.includes('/AccountReset/Login')) {
      const errorMsg = await page.$eval('ul li', el => el.textContent.trim()).catch(() => 'credenciales incorrectas');
      throw new Error(`Login falló: ${errorMsg}`);
    }
    console.log(`  ✅ Login OK`);

    // 2. Ir a Asistencia Virtual
    await page.goto(`${config.baseUrl}/bi/RegistroAsistenciaVirtual`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('.btnPresencial', { timeout: 10000 });

    // 3. Clic en Presencial
    await page.click('.btnPresencial');
    await page.waitForTimeout(1000);

    // Esperar a que aparezcan los botones de marcaje
    const btnId = tipo === 'entrada' ? '#btnEntrada' : '#btnSalida';
    await page.waitForSelector(btnId, { timeout: 10000 });

    // 4. Mockear Date
    await page.evaluate((t) => {
      const OrigDate = Date;
      const mockedDate = new OrigDate(t.year, t.month - 1, t.day, t.hora, t.minuto, t.segundo);
      window.Date = class extends OrigDate {
        constructor(...args) {
          if (args.length === 0) {
            super(mockedDate.getTime());
          } else {
            super(...args);
          }
        }
        static now() { return mockedDate.getTime(); }
      };
    }, time);

    // 5. Reset dialog message
    dialogMessage = '';

    // 6. Clic en Entrada o Salida
    await page.click(btnId);

    // Esperar AJAX y posible submit
    await page.waitForTimeout(3000);

    // Esperar a que la página termine de cargar (con timeout generoso)
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // 7. Verificar si hubo un alert de error (no un confirm)
    if (dialogMessage && !dialogMessage.includes('¿Desea sustituir') && !dialogMessage.includes('¿desea sustituir')) {
      throw new Error(`Servidor rechazó: ${dialogMessage}`);
    }

    // 8. Verificar resultado en la tabla
    const todayStr = getTodayStr();
    const marcas = await page.evaluate((today) => {
      const rows = document.querySelectorAll('table tr');
      let entrada = '';
      let salida = '';
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length > 1 && cells[0]?.textContent?.trim()?.includes(today)) {
          entrada = cells[1]?.textContent?.trim() || '';
          salida = cells[7]?.textContent?.trim() || '';
        }
      });
      return { entrada, salida };
    }, todayStr);

    const valor = tipo === 'entrada' ? marcas.entrada : marcas.salida;
    if (valor) {
      console.log(`  ✅ ${tipoNombre} confirmada: ${valor}`);
    } else {
      console.log(`  ⚠️  ${tipoNombre} no confirmada en tabla`);
      console.log(`     entrada=${marcas.entrada || 'N/A'}, salida=${marcas.salida || 'N/A'}`);
    }

    await context.close();
    return { username, success: true, fecha: fechaStr, confirmada: valor };
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    await context.close();
    return { username, success: false, error: error.message };
  }
}

async function marcarTodos(browser, tipo) {
  const tipoNombre = tipo === 'entrada' ? 'ENTRADA' : 'SALIDA';
  const rango = tipo === 'entrada' ? config.horarios.entrada : config.horarios.salida;

  console.log('═══════════════════════════════════════════');
  console.log(`🕐 Marcaje automático: ${tipoNombre}`);
  console.log(`👥 Usuarios: ${config.usuarios.length}`);
  console.log(`⏰ Rango: ${rango.horaInicio.hora}:${String(rango.horaInicio.minuto).padStart(2, '0')} - ${rango.horaFin.hora}:${String(rango.horaFin.minuto).padStart(2, '0')}`);
  console.log('═══════════════════════════════════════════');

  const resultados = [];
  for (const username of config.usuarios) {
    const resultado = await marcarUsuario(browser, username, tipo);
    resultados.push(resultado);
  }
  return resultados;
}

async function marcarTodo() {
  console.log('🔄 Marcaje completo: ENTRADA + SALIDA\n');

  const browser = await chromium.launch({ headless: true });

  const resEntrada = await marcarTodos(browser, 'entrada');
  console.log('');
  const resSalida = await marcarTodos(browser, 'salida');

  await browser.close();

  const todos = [
    ...resEntrada.map(r => ({ ...r, tipo: 'ENTRADA' })),
    ...resSalida.map(r => ({ ...r, tipo: 'SALIDA' })),
  ];
  const exitosos = todos.filter(r => r.success);
  const fallidos = todos.filter(r => !r.success);

  console.log('\n═══════════════════════════════════════════');
  console.log('📊 RESUMEN FINAL');
  console.log('═══════════════════════════════════════════');
  if (exitosos.length > 0) {
    console.log(`  ✅ Exitosos: ${exitosos.length}/${todos.length}`);
    exitosos.forEach(r => console.log(`     ${r.username} [${r.tipo}] → ${r.fecha}`));
  }
  if (fallidos.length > 0) {
    console.log(`  ❌ Fallidos: ${fallidos.length}/${todos.length}`);
    fallidos.forEach(r => console.log(`     ${r.username} [${r.tipo}] → ${r.error}`));
  }
}

async function marcarSolo(tipo) {
  const browser = await chromium.launch({ headless: true });
  const resultados = await marcarTodos(browser, tipo);
  await browser.close();

  const exitosos = resultados.filter(r => r.success);
  const fallidos = resultados.filter(r => !r.success);
  console.log('\n═══════════════════════════════════════════');
  console.log('📊 RESUMEN');
  console.log('═══════════════════════════════════════════');
  console.log(`  ✅ Exitosos: ${exitosos.length}/${resultados.length}`);
  exitosos.forEach(r => console.log(`     ${r.username} → ${r.fecha}`));
  if (fallidos.length > 0) {
    console.log(`  ❌ Fallidos: ${fallidos.length}`);
    fallidos.forEach(r => console.log(`     ${r.username} → ${r.error}`));
  }
}

async function test() {
  console.log('🧪 Modo test - verificando conexión\n');
  const browser = await chromium.launch({ headless: true });

  for (const username of config.usuarios) {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    console.log(`  👤 ${username}...`);
    try {
      await page.goto(`${config.baseUrl}/Account/Login`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#txtUsername', { timeout: 10000 });
      await page.fill('#txtUsername', username);
      await page.fill('#txtPassword', config.password);
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
        page.click('input[name="btnIniciarSesion"]'),
      ]);
      await page.waitForTimeout(2000);

      if (page.url().includes('/Account/Login') || page.url().includes('/AccountReset/Login')) {
        const errorMsg = await page.$eval('ul li', el => el.textContent.trim()).catch(() => '');
        throw new Error(`Login falló: ${errorMsg}`);
      }

      await page.goto(`${config.baseUrl}/bi/RegistroAsistenciaVirtual`, { waitUntil: 'domcontentloaded' });
      const exp = await page.$eval('#CodigoExpediente', el => el.value);
      console.log(`     ✅ OK (expediente: ${exp})`);
    } catch (error) {
      console.error(`     ❌ ${error.message}`);
    }
    await context.close();
  }

  await browser.close();
}

// CLI
const action = process.argv[2];

if (!action || !['entrada', 'salida', 'todo', 'test'].includes(action)) {
  console.log('Uso: node index.js <entrada|salida|todo|test>');
  console.log('  entrada  - Marca entrada para todos');
  console.log('  salida   - Marca salida para todos');
  console.log('  todo     - Marca entrada y salida para todos');
  console.log('  test     - Verifica conexión sin marcar');
  process.exit(1);
}

if (action === 'test') {
  test();
} else if (action === 'todo') {
  marcarTodo();
} else {
  marcarSolo(action);
}
