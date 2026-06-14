'use strict';

// Genera docs/HT-AP-03_Pruebas_v1.0.pdf con imagen corporativa HidroTecnica.
// Uso: NODE_PATH=backend/node_modules node docs/scripts/generar_pdf_ht-ap-03.js
// Reglas de marca: logo bi-color sobre fondo blanco, ícono a la izquierda,
// proporciones originales (height fijo, width automático), paleta autorizada.

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const NAVY = '#112548';
const CYAN = '#34B3DE';
const GRIS = '#555555';
const TEXTO = '#1f2d44';
const LINEA = '#e2e8f0';
const CODE_BG = '#f5f8fb';

const logoPath = path.join(__dirname, '..', 'assets', 'Hidrotecnica.jpg');
const outPath = path.join(__dirname, '..', 'HT-AP-03_Pruebas_v1.0.pdf');

const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 55, left: 50, right: 50 } });
doc.pipe(fs.createWriteStream(outPath));

const left = doc.page.margins.left;
const right = doc.page.width - doc.page.margins.right;
const bottom = doc.page.height - doc.page.margins.bottom;
const contentW = right - left;

function ensure(h) {
  if (doc.y + h > bottom) doc.addPage();
}

function sectionHeader(num, title) {
  ensure(50);
  doc.moveDown(0.9);
  const y = doc.y;
  doc.roundedRect(left, y, 22, 18, 3).fill(NAVY);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(11).text(num, left, y + 4.5, { width: 22, align: 'center' });
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(15).text(title, left + 30, y + 2);
  const yEnd = doc.y + 5;
  doc.moveTo(left, yEnd).lineTo(right, yEnd).lineWidth(0.5).strokeColor(LINEA).stroke();
  doc.y = yEnd + 8;
  doc.fillColor(TEXTO);
}

function h3(t) {
  ensure(26);
  doc.moveDown(0.3);
  doc.font('Helvetica-Bold').fontSize(11.5).fillColor(NAVY).text(t);
  doc.moveDown(0.2);
}

function para(text) {
  ensure(28);
  doc.font('Helvetica').fontSize(10.5).fillColor(TEXTO).text(text, { align: 'left', width: contentW });
  doc.moveDown(0.45);
}

function bullets(arr) {
  doc.font('Helvetica').fontSize(10.5).fillColor(TEXTO);
  arr.forEach((t) => {
    ensure(20);
    doc.text('•  ' + t, left + 6, doc.y, { width: contentW - 6 });
  });
  doc.moveDown(0.45);
}

function code(lines) {
  const lh = 12.5;
  const pad = 10;
  const h = lines.length * lh + pad * 2;
  ensure(h + 8);
  const y = doc.y;
  doc.save();
  doc.rect(left, y, contentW, h).fill(CODE_BG);
  doc.rect(left, y, 3, h).fill(CYAN);
  doc.restore();
  doc.font('Courier').fontSize(9.5).fillColor(NAVY);
  let ty = y + pad;
  lines.forEach((l) => {
    doc.text(l, left + 12, ty, { lineBreak: false });
    ty += lh;
  });
  doc.y = y + h + 10;
  doc.fillColor(TEXTO);
}

function tablaResultados(rows) {
  ensure(30 + rows.length * 22);
  const cols = [contentW * 0.5, contentW * 0.25, contentW * 0.25];
  const yh = doc.y;
  doc.rect(left, yh, contentW, 22).fill(NAVY);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10.5);
  doc.text('Suite', left + 10, yh + 6, { width: cols[0] });
  doc.text('Casos', left + cols[0], yh + 6, { width: cols[1] });
  doc.text('Estado', left + cols[0] + cols[1], yh + 6, { width: cols[2] });
  let y = yh + 22;
  rows.forEach((r) => {
    doc.font('Helvetica').fontSize(10.5).fillColor(TEXTO);
    doc.text(r[0], left + 10, y + 6, { width: cols[0] });
    doc.text(String(r[1]), left + cols[0], y + 6, { width: cols[1] });
    doc.fillColor('#16a34a').font('Helvetica-Bold').text(r[2], left + cols[0] + cols[1], y + 6, { width: cols[2] });
    doc.moveTo(left, y + 22).lineTo(right, y + 22).lineWidth(0.5).strokeColor(LINEA).stroke();
    y += 22;
  });
  doc.y = y + 6;
}

// ─── Encabezado de marca ──────────────────────────────────────────────────
doc.image(logoPath, left, 46, { height: 40 }); // proporciones originales
doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(11).text('HT-AP-03 · v1.0', right - 160, 48, { width: 160, align: 'right' });
doc.fillColor(GRIS).font('Helvetica').fontSize(10).text('2026-06-14', right - 160, 63, { width: 160, align: 'right' });
doc.moveTo(left, 96).lineTo(right, 96).lineWidth(3).strokeColor(CYAN).stroke();
doc.y = 112;

doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(22).text('Pruebas Automatizadas — Control de EPP');
doc.fillColor(CYAN).font('Helvetica-Bold').fontSize(11).text('Aplicación: control-epp-ht-production.up.railway.app  ·  Documento relacionado: HT-AP-02');
doc.moveDown(0.5);

// ─── 1. Propósito ─────────────────────────────────────────────────────────
sectionHeader('1', 'Propósito');
para('Describir la infraestructura de pruebas automatizadas de la aplicación: qué se verifica, cómo ejecutarla y cómo mantenerla al agregar nuevas funcionalidades.');
para('El objetivo es evitar regresiones, en particular los desajustes entre la forma de datos que entrega el backend y la que espera el frontend, que fueron la causa de los crashes corregidos en esta fase.');

// ─── 2. Alcance ───────────────────────────────────────────────────────────
sectionHeader('2', 'Alcance');
h3('2.1 Qué se prueba');
para('Backend — pruebas de integración (12 casos). Levantan el servidor Express contra una base de datos SQLite temporal y verifican la forma de respuesta de cada endpoint contra lo que el frontend consume:');
bullets([
  'Autenticación (login de administrador).',
  'GET /users, GET /epp, GET /stock (incluye alias epp_id / epp_nombre).',
  'Creación de EPP e ingreso de stock.',
  'Entrega directa (POST /entregas/directa) sin solicitud previa.',
  'Movimientos de stock ({epp, movimientos} con usuario_nombre).',
  'Asignaciones por trabajador (asignaciones + historial_entregas).',
  'Matriz de asignaciones (devuelta como array).',
  'Reportes: stock crítico ({total, items}) y vencimientos.',
  'Solicitud completa: crear, listar pendientes con items_count, ver detalle con stock_disponible.',
  'Eliminación de EPP: 409 si tiene registros asociados, 200 si no.',
]);
para('Frontend — pruebas de componente (22 casos, 20/20 páginas). Renderizan cada página con el módulo api simulado (mock) y verifican que rendericen correctamente y no crasheen con la forma de datos real, incluyendo casos de datos vacíos.');
h3('2.2 Qué NO se prueba (limitaciones conocidas)');
bullets([
  'Flujos end-to-end reales (navegador + backend + base de datos juntos).',
  'Generación y contenido de los PDF (services/pdf.js).',
  'Envío real de correos (el servicio falla en silencio sin SMTP).',
  'Estilos visuales / layout (CSS).',
  'Carga y almacenamiento físico de archivos en el volumen de Railway.',
]);

// ─── 3. Cómo ejecutar ─────────────────────────────────────────────────────
sectionHeader('3', 'Cómo ejecutar las pruebas');
h3('3.1 Backend');
code(['cd backend', 'npm install      # solo la primera vez', 'npm test']);
para('Usa el runner nativo de Node (node --test), sin dependencias adicionales. Cada corrida crea una base de datos temporal aislada; no toca datos reales.');
h3('3.2 Frontend');
code(['cd frontend', 'npm install      # solo la primera vez', 'npm test']);
para('Usa Vitest + React Testing Library sobre un entorno jsdom. Estas dependencias son de desarrollo y no afectan el despliegue en Railway.');
h3('3.3 Requisitos');
bullets([
  'Node.js 18 o superior (validado en Node 22).',
  'No requiere base de datos, SMTP ni red.',
]);

// ─── 4. Estructura ────────────────────────────────────────────────────────
sectionHeader('4', 'Estructura de archivos');
code([
  'backend/',
  '  server.js              # exporta { app, initDb }; escucha solo si se ejecuta directo',
  '  test/',
  '    api.test.js          # 12 pruebas de integración de la API',
  '',
  'frontend/',
  '  vite.config.js         # bloque "test" (jsdom, setup)',
  '  src/test/',
  '    setup.js             # matchers jest-dom + limpieza entre pruebas',
  '    utils.jsx            # helper renderPage (Router + AuthProvider + localStorage)',
  '  src/pages/**/*.test.jsx # una prueba co-ubicada por cada página',
]);

// ─── 5. Cómo agregar una prueba ───────────────────────────────────────────
sectionHeader('5', 'Cómo agregar una prueba nueva');
h3('5.1 Al agregar un endpoint en el backend');
bullets([
  'Abrir backend/test/api.test.js.',
  'Agregar un bloque test(\'...\', async () => { ... }).',
  'Usar el helper req(method, path, { body, form }); el token de admin se obtiene en test.before.',
  'Afirmar la forma exacta de la respuesta (campos y tipos) que el frontend espera.',
]);
h3('5.2 Al agregar una página en el frontend');
bullets([
  'Crear NombrePagina.test.jsx junto al componente (mismo directorio), para que el mock coincida con el import.',
  'Simular las respuestas de api con vi.fn() / mockResolvedValue.',
  'Renderizar con renderPage(<NombrePagina />, { user, path, route }) cuando use useAuth o useParams.',
  'Afirmar que el dato clave aparece en pantalla (y, si corresponde, un caso con datos vacíos).',
]);
h3('5.3 Regla de oro');
para('Cada vez que el frontend consuma un endpoint nuevo o modifique uno existente, verificar que la forma de datos (array vs objeto, nombres de campos) coincida en ambos lados y agregar/ajustar la prueba correspondiente.');

// ─── 6. Resultado actual ──────────────────────────────────────────────────
sectionHeader('6', 'Resultado actual');
tablaResultados([['Backend', 12, 'verde'], ['Frontend', 22, 'verde']]);
doc.font('Helvetica').fontSize(9.5).fillColor(GRIS).text('Última verificación: 2026-06-14.');

// ─── Pie ──────────────────────────────────────────────────────────────────
doc.font('Helvetica').fontSize(9).fillColor(GRIS);
doc.text('HidroTecnica SpA — Documento interno', left, bottom + 10, { width: contentW / 2 });
doc.text('HT-AP-03 · v1.0', left + contentW / 2, bottom + 10, { width: contentW / 2, align: 'right' });

doc.end();
console.log('PDF generado en', outPath);
