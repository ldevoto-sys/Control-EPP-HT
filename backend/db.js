const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// En Railway: montar volumen en /data y setear RAILWAY_VOLUME_MOUNT_PATH=/data
// En desarrollo: usar ./data local
const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'db')
  : path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'epp.db');
const db = new sqlite3.Database(dbPath);

// Promisify helpers
db.runAsync = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    })
  );

db.getAsync = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    })
  );

db.allAsync = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    })
  );

db.execAsync = (sql) =>
  new Promise((resolve, reject) =>
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    })
  );

async function initDb() {
  // Habilitar foreign keys
  await db.runAsync('PRAGMA foreign_keys = ON');

  // Crear tablas
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      rut TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      rol TEXT NOT NULL CHECK(rol IN ('administrador','operador','autorizador','bodega','consulta')),
      activo INTEGER DEFAULT 1,
      must_change_password INTEGER DEFAULT 1,
      reset_token TEXT,
      reset_token_expires TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS epp_catalogo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      categoria TEXT NOT NULL,
      descripcion TEXT,
      unidad TEXT NOT NULL DEFAULT 'unidad',
      vida_util_meses INTEGER,
      stock_actual INTEGER NOT NULL DEFAULT 0,
      stock_minimo INTEGER NOT NULL DEFAULT 0,
      activo INTEGER DEFAULT 1,
      foto_catalogo TEXT,
      certificado_tecnico TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS solicitudes_epp (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      solicitante_id INTEGER NOT NULL REFERENCES users(id),
      trabajador_id INTEGER NOT NULL REFERENCES users(id),
      estado TEXT NOT NULL DEFAULT 'pendiente'
        CHECK(estado IN ('pendiente','aprobada','rechazada','entregada','anulada')),
      comentario_autorizador TEXT,
      autorizador_id INTEGER REFERENCES users(id),
      fecha_solicitud TEXT DEFAULT (datetime('now')),
      fecha_resolucion TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS solicitud_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      solicitud_id INTEGER NOT NULL REFERENCES solicitudes_epp(id) ON DELETE CASCADE,
      epp_id INTEGER NOT NULL REFERENCES epp_catalogo(id),
      cantidad INTEGER NOT NULL DEFAULT 1,
      motivo TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entregas_epp (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      solicitud_id INTEGER REFERENCES solicitudes_epp(id),
      trabajador_id INTEGER NOT NULL REFERENCES users(id),
      bodeguero_id INTEGER NOT NULL REFERENCES users(id),
      fecha_entrega TEXT NOT NULL,
      observacion TEXT,
      foto_entrega TEXT,
      pdf_entrega TEXT,
      pdf_firmado TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS entrega_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entrega_id INTEGER NOT NULL REFERENCES entregas_epp(id) ON DELETE CASCADE,
      epp_id INTEGER NOT NULL REFERENCES epp_catalogo(id),
      cantidad INTEGER NOT NULL,
      numero_serie TEXT,
      fecha_vencimiento TEXT,
      certificado_adjunto TEXT
    );

    CREATE TABLE IF NOT EXISTS asignaciones_activas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trabajador_id INTEGER NOT NULL REFERENCES users(id),
      epp_id INTEGER NOT NULL REFERENCES epp_catalogo(id),
      cantidad INTEGER NOT NULL DEFAULT 1,
      fecha_asignacion TEXT NOT NULL,
      fecha_vencimiento TEXT,
      entrega_id INTEGER REFERENCES entregas_epp(id),
      UNIQUE(trabajador_id, epp_id)
    );

    CREATE TABLE IF NOT EXISTS devoluciones_epp (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trabajador_id INTEGER NOT NULL REFERENCES users(id),
      epp_id INTEGER NOT NULL REFERENCES epp_catalogo(id),
      cantidad INTEGER NOT NULL,
      motivo TEXT NOT NULL
        CHECK(motivo IN ('fin_contrato','deterioro','cambio_talla','perdida','otro')),
      registrado_por_id INTEGER NOT NULL REFERENCES users(id),
      fecha_devolucion TEXT NOT NULL,
      observacion TEXT,
      foto_devolucion TEXT,
      vuelve_a_stock INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stock_movimientos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      epp_id INTEGER NOT NULL REFERENCES epp_catalogo(id),
      tipo TEXT NOT NULL
        CHECK(tipo IN ('ingreso','egreso','ajuste','devolucion','baja')),
      cantidad INTEGER NOT NULL,
      stock_anterior INTEGER NOT NULL,
      stock_resultante INTEGER NOT NULL,
      referencia TEXT,
      usuario_id INTEGER NOT NULL REFERENCES users(id),
      fecha TEXT NOT NULL,
      observacion TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS solicitud_historial (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      solicitud_id INTEGER NOT NULL REFERENCES solicitudes_epp(id) ON DELETE CASCADE,
      estado TEXT NOT NULL,
      usuario_id INTEGER NOT NULL REFERENCES users(id),
      comentario TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Seed: admin
  const adminExiste = await db.getAsync('SELECT id FROM users LIMIT 1');
  if (!adminExiste) {
    const hash = await bcrypt.hash('Admin2024!', 10);
    await db.runAsync(
      `INSERT INTO users (nombre, rut, email, password_hash, rol, must_change_password)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['Administrador', '11.111.111-1', 'admin@hidrotecnica.cl', hash, 'administrador', 0]
    );
    console.log('[DB] Usuario administrador creado.');
  }

  // Seed: EPP catálogo
  const eppExiste = await db.getAsync('SELECT id FROM epp_catalogo LIMIT 1');
  if (!eppExiste) {
    const epps = [
      { nombre: 'Casco de Seguridad',       categoria: 'Cabeza',       unidad: 'unidad', vida_util_meses: 48 },
      { nombre: 'Lentes de Seguridad',       categoria: 'Visual',       unidad: 'unidad', vida_util_meses: 12 },
      { nombre: 'Protector Auditivo Espuma', categoria: 'Auditivo',     unidad: 'par',    vida_util_meses: null },
      { nombre: 'Guantes de Nitrilo',        categoria: 'Manos',        unidad: 'par',    vida_util_meses: 3 },
      { nombre: 'Guantes de Cuero',          categoria: 'Manos',        unidad: 'par',    vida_util_meses: 6 },
      { nombre: 'Guantes Dieléctricos',      categoria: 'Manos',        unidad: 'par',    vida_util_meses: 12 },
      { nombre: 'Zapatos de Seguridad',      categoria: 'Pies',         unidad: 'par',    vida_util_meses: 12 },
      { nombre: 'Chaleco Reflectante',       categoria: 'Cuerpo',       unidad: 'unidad', vida_util_meses: 24 },
      { nombre: 'Arnés de Seguridad',        categoria: 'Altura',       unidad: 'unidad', vida_util_meses: 60 },
      { nombre: 'Mascarilla Desechable',     categoria: 'Respiratoria', unidad: 'unidad', vida_util_meses: null },
      { nombre: 'Traje Tyvek',               categoria: 'Cuerpo',       unidad: 'unidad', vida_util_meses: null },
    ];
    for (const epp of epps) {
      await db.runAsync(
        `INSERT INTO epp_catalogo (nombre, categoria, unidad, vida_util_meses) VALUES (?, ?, ?, ?)`,
        [epp.nombre, epp.categoria, epp.unidad, epp.vida_util_meses ?? null]
      );
    }
    console.log('[DB] Catálogo EPP inicial creado.');
  }

  // Migración: permitir solicitud_id NULL en entregas_epp (entrega directa sin solicitud)
  try {
    const cols = await db.allAsync("PRAGMA table_info(entregas_epp)");
    const colSolicitud = cols.find(c => c.name === 'solicitud_id');
    if (colSolicitud && colSolicitud.notnull === 1) {
      // SQLite no soporta DROP NOT NULL directamente; reconstruir la tabla
      await db.execAsync(`
        PRAGMA foreign_keys = OFF;
        CREATE TABLE IF NOT EXISTS entregas_epp_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          solicitud_id INTEGER REFERENCES solicitudes_epp(id),
          trabajador_id INTEGER NOT NULL REFERENCES users(id),
          bodeguero_id INTEGER NOT NULL REFERENCES users(id),
          fecha_entrega TEXT NOT NULL,
          observacion TEXT,
          foto_entrega TEXT,
          pdf_entrega TEXT,
          pdf_firmado TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO entregas_epp_new SELECT * FROM entregas_epp;
        DROP TABLE entregas_epp;
        ALTER TABLE entregas_epp_new RENAME TO entregas_epp;
        PRAGMA foreign_keys = ON;
      `);
      console.log('[DB] Migración: solicitud_id ahora permite NULL en entregas_epp.');
    }
  } catch (migErr) {
    console.error('[DB] Error en migración entregas_epp:', migErr);
  }

  console.log('[DB] Base de datos lista.');
}

module.exports = { db, initDb };
