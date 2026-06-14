'use strict';

// Pruebas de integración de la API.
// Levantan el backend contra una base de datos temporal y verifican que la
// forma de cada respuesta coincida con lo que el frontend espera.

const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const path = require('path');
const fs = require('fs');

// BD temporal aislada — debe definirse ANTES de importar el servidor,
// porque db.js abre la base al cargarse.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'epp-test-'));
process.env.RAILWAY_VOLUME_MOUNT_PATH = tmpDir;
process.env.NODE_ENV = 'test';

const { app, initDb } = require('../server');

let server;
let baseUrl;
let token;

// IDs creados durante las pruebas
let eppId;
let eppSinUsoId;

async function req(method, p, { body, auth = true, form } = {}) {
  const headers = {};
  if (auth && token) headers['Authorization'] = `Bearer ${token}`;
  let payload;
  if (form) {
    payload = form; // FormData; fetch fija el content-type
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${baseUrl}${p}`, { method, headers, body: payload });
  let data = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) data = await res.json();
  return { status: res.status, data };
}

test.before(async () => {
  await initDb();
  server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  const login = await req('POST', '/auth/login', {
    auth: false,
    body: { email: 'admin@hidrotecnica.cl', password: 'Admin2024!' },
  });
  assert.strictEqual(login.status, 200, 'login admin debe responder 200');
  token = login.data.token;
  assert.ok(token, 'login debe devolver token');
});

test.after(() => {
  if (server) server.close();
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
});

test('GET /users devuelve un array con rut y email', async () => {
  const { status, data } = await req('GET', '/users');
  assert.strictEqual(status, 200);
  assert.ok(Array.isArray(data), 'debe ser array');
  assert.ok(data.length >= 1);
  assert.ok('rut' in data[0] && 'email' in data[0]);
});

test('GET /epp devuelve un array', async () => {
  const { status, data } = await req('GET', '/epp');
  assert.strictEqual(status, 200);
  assert.ok(Array.isArray(data));
});

test('POST /epp crea un EPP y POST ingreso-stock suma stock', async () => {
  const crear = await req('POST', '/epp', {
    body: { nombre: 'EPP Prueba Casco', categoria: 'Cabeza', unidad: 'unidad', vida_util_meses: 12, stock_minimo: 1 },
  });
  assert.strictEqual(crear.status, 201);
  eppId = crear.data.id;
  assert.ok(eppId);

  const ingreso = await req('POST', `/epp/${eppId}/ingreso-stock`, {
    body: { cantidad: 10, referencia: 'Factura test', observacion: 'carga inicial' },
  });
  assert.strictEqual(ingreso.status, 200);
  assert.strictEqual(ingreso.data.stock_actual, 10);
});

test('GET /stock incluye epp_id y epp_nombre (consumidos por Stock.jsx)', async () => {
  const { status, data } = await req('GET', '/stock');
  assert.strictEqual(status, 200);
  assert.ok(Array.isArray(data));
  const fila = data.find(i => i.epp_id === eppId);
  assert.ok(fila, 'debe encontrarse el EPP creado');
  assert.strictEqual(fila.epp_nombre, 'EPP Prueba Casco');
  assert.ok('stock_actual' in fila && 'stock_minimo' in fila);
});

test('POST /entregas/directa registra entrega sin solicitud', async () => {
  const form = new FormData();
  form.append('trabajador_id', '1'); // admin como trabajador
  form.append('fecha_entrega', new Date().toISOString().slice(0, 10));
  form.append('observacion', 'entrega de prueba');
  form.append('items', JSON.stringify([{ epp_id: eppId, cantidad: 2, numero_serie: 'SN-1' }]));

  const { status, data } = await req('POST', '/entregas/directa', { form });
  assert.strictEqual(status, 201, `esperaba 201, body: ${JSON.stringify(data)}`);
  assert.ok(data.id);
});

test('GET /stock/:id/movimientos devuelve {epp, movimientos} con usuario_nombre', async () => {
  const { status, data } = await req('GET', `/stock/${eppId}/movimientos`);
  assert.strictEqual(status, 200);
  assert.ok(!Array.isArray(data), 'debe ser objeto, no array');
  assert.ok('epp' in data && 'movimientos' in data);
  assert.ok(Array.isArray(data.movimientos));
  assert.ok(data.movimientos.length >= 2, 'ingreso + egreso');
  assert.ok('usuario_nombre' in data.movimientos[0]);
  const tipos = data.movimientos.map(m => m.tipo);
  assert.ok(tipos.includes('ingreso') && tipos.includes('egreso'));
});

test('GET /asignaciones/trabajador/:id devuelve asignaciones e historial_entregas', async () => {
  const { status, data } = await req('GET', '/asignaciones/trabajador/1');
  assert.strictEqual(status, 200);
  assert.ok(Array.isArray(data.asignaciones), 'asignaciones debe ser array');
  assert.ok(Array.isArray(data.historial_entregas), 'historial_entregas debe ser array');
  const asig = data.asignaciones.find(a => a.epp_id === eppId);
  assert.ok(asig, 'debe existir la asignación recién creada');
  assert.ok('epp_nombre' in asig && 'estado_vencimiento' in asig);
  assert.ok(data.historial_entregas.length >= 1);
  assert.ok(Array.isArray(data.historial_entregas[0].items), 'cada entrega lleva items');
});

test('GET /asignaciones/matriz devuelve asignaciones como ARRAY (consumido por Documentacion.jsx)', async () => {
  const { status, data } = await req('GET', '/asignaciones/matriz');
  assert.strictEqual(status, 200);
  assert.ok(Array.isArray(data.trabajadores));
  assert.ok(Array.isArray(data.epps));
  assert.ok(Array.isArray(data.asignaciones), 'asignaciones DEBE ser array para .find()');
  const a = data.asignaciones.find(x => x.epp_id === eppId);
  assert.ok(a, 'asignación presente en matriz');
  assert.ok('trabajador_id' in a && 'epp_id' in a && 'estado_vencimiento' in a);
});

test('GET /reports/stock-critico devuelve {total, items}', async () => {
  const { status, data } = await req('GET', '/reports/stock-critico');
  assert.strictEqual(status, 200);
  assert.strictEqual(typeof data.total, 'number');
  assert.ok(Array.isArray(data.items));
});

test('GET /reports/vencimientos devuelve {proximos_a_vencer, vencidos}', async () => {
  const { status, data } = await req('GET', '/reports/vencimientos');
  assert.strictEqual(status, 200);
  assert.ok(Array.isArray(data.proximos_a_vencer));
  assert.ok(Array.isArray(data.vencidos));
});

test('Solicitud: crear, listar pendientes con items_count y ver detalle con stock_disponible', async () => {
  // Crear segundo EPP para la solicitud
  const epp2 = await req('POST', '/epp', {
    body: { nombre: 'EPP Prueba Guante', categoria: 'Manos', unidad: 'par', stock_minimo: 0 },
  });
  assert.strictEqual(epp2.status, 201);

  const crear = await req('POST', '/solicitudes', {
    body: {
      trabajador_id: 1,
      items: [
        { epp_id: eppId, cantidad: 1, motivo: 'primera_entrega' },
        { epp_id: epp2.data.id, cantidad: 2, motivo: 'primera_entrega' },
      ],
    },
  });
  assert.strictEqual(crear.status, 201, `body: ${JSON.stringify(crear.data)}`);
  const solId = crear.data.id;

  const pend = await req('GET', '/solicitudes/pendientes');
  assert.strictEqual(pend.status, 200);
  const sol = pend.data.find(s => s.id === solId);
  assert.ok(sol, 'la solicitud debe aparecer en pendientes');
  assert.strictEqual(sol.items_count, 2, 'items_count debe reflejar los ítems');

  const detalle = await req('GET', `/solicitudes/${solId}`);
  assert.strictEqual(detalle.status, 200);
  assert.ok(Array.isArray(detalle.data.items));
  assert.ok('stock_disponible' in detalle.data.items[0], 'items deben incluir stock_disponible');
});

test('DELETE /epp con registros asociados responde 409; sin registros responde 200', async () => {
  // eppId tiene movimientos y asignaciones → no se puede eliminar
  const conUso = await req('DELETE', `/epp/${eppId}`);
  assert.strictEqual(conUso.status, 409, 'EPP en uso no debe eliminarse');

  // EPP nuevo sin referencias → se elimina
  const nuevo = await req('POST', '/epp', {
    body: { nombre: 'EPP Borrable', categoria: 'Otro', unidad: 'unidad', stock_minimo: 0 },
  });
  assert.strictEqual(nuevo.status, 201);
  eppSinUsoId = nuevo.data.id;
  const del = await req('DELETE', `/epp/${eppSinUsoId}`);
  assert.strictEqual(del.status, 200);
});
