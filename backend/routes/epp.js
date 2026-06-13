const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const { authenticate, authorize } = require('../middleware/auth');
const { db } = require('../db');

// Directorio de uploads
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Todos los endpoints requieren autenticación
router.use(authenticate);

// GET /api/epp — lista todo el catálogo
router.get('/', async (req, res) => {
  try {
    const rows = await db.allAsync(`
      SELECT id, nombre, categoria, descripcion, unidad, vida_util_meses,
             stock_actual, stock_minimo, activo, foto_catalogo, certificado_tecnico, created_at
      FROM epp_catalogo
      ORDER BY categoria ASC, nombre ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error('[EPP] GET /:', err);
    res.status(500).json({ error: 'Error al obtener catálogo EPP' });
  }
});

// GET /api/epp/activos — solo EPP activos (para selectores). DEBE ir antes de /:id
router.get('/activos', async (req, res) => {
  try {
    const rows = await db.allAsync(`
      SELECT id, nombre, categoria, descripcion, unidad, vida_util_meses,
             stock_actual, stock_minimo, activo, foto_catalogo, certificado_tecnico, created_at
      FROM epp_catalogo
      WHERE activo = 1
      ORDER BY categoria ASC, nombre ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error('[EPP] GET /activos:', err);
    res.status(500).json({ error: 'Error al obtener EPP activos' });
  }
});

// GET /api/epp/:id — un EPP por id
router.get('/:id', async (req, res) => {
  try {
    const row = await db.getAsync(`
      SELECT id, nombre, categoria, descripcion, unidad, vida_util_meses,
             stock_actual, stock_minimo, activo, foto_catalogo, certificado_tecnico, created_at
      FROM epp_catalogo
      WHERE id = ?
    `, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'EPP no encontrado' });
    res.json(row);
  } catch (err) {
    console.error('[EPP] GET /:id:', err);
    res.status(500).json({ error: 'Error al obtener EPP' });
  }
});

// POST /api/epp — crear EPP
router.post('/', authorize('administrador'), async (req, res) => {
  const { nombre, categoria, descripcion, unidad, vida_util_meses, stock_minimo } = req.body;
  if (!nombre || !categoria || !unidad) {
    return res.status(400).json({ error: 'nombre, categoria y unidad son requeridos' });
  }
  try {
    const existe = await db.getAsync('SELECT id FROM epp_catalogo WHERE nombre = ?', [nombre]);
    if (existe) return res.status(409).json({ error: 'Ya existe un EPP con ese nombre' });

    const result = await db.runAsync(
      `INSERT INTO epp_catalogo (nombre, categoria, descripcion, unidad, vida_util_meses, stock_minimo, stock_actual)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [nombre, categoria, descripcion || null, unidad, vida_util_meses || null, stock_minimo || 0]
    );
    const nuevo = await db.getAsync('SELECT * FROM epp_catalogo WHERE id = ?', [result.lastID]);
    res.status(201).json(nuevo);
  } catch (err) {
    console.error('[EPP] POST /:', err);
    res.status(500).json({ error: 'Error al crear EPP' });
  }
});

// PUT /api/epp/:id — editar EPP
router.put('/:id', authorize('administrador'), async (req, res) => {
  const { nombre, categoria, descripcion, unidad, vida_util_meses, stock_minimo, activo } = req.body;
  try {
    const epp = await db.getAsync('SELECT * FROM epp_catalogo WHERE id = ?', [req.params.id]);
    if (!epp) return res.status(404).json({ error: 'EPP no encontrado' });

    if (nombre && nombre !== epp.nombre) {
      const existe = await db.getAsync('SELECT id FROM epp_catalogo WHERE nombre = ? AND id != ?', [nombre, req.params.id]);
      if (existe) return res.status(409).json({ error: 'Ya existe un EPP con ese nombre' });
    }

    await db.runAsync(
      `UPDATE epp_catalogo SET
        nombre = ?, categoria = ?, descripcion = ?, unidad = ?,
        vida_util_meses = ?, stock_minimo = ?, activo = ?
       WHERE id = ?`,
      [
        nombre ?? epp.nombre,
        categoria ?? epp.categoria,
        descripcion !== undefined ? descripcion : epp.descripcion,
        unidad ?? epp.unidad,
        vida_util_meses !== undefined ? vida_util_meses : epp.vida_util_meses,
        stock_minimo !== undefined ? stock_minimo : epp.stock_minimo,
        activo !== undefined ? activo : epp.activo,
        req.params.id
      ]
    );
    const actualizado = await db.getAsync('SELECT * FROM epp_catalogo WHERE id = ?', [req.params.id]);
    res.json(actualizado);
  } catch (err) {
    console.error('[EPP] PUT /:id:', err);
    res.status(500).json({ error: 'Error al actualizar EPP' });
  }
});

// POST /api/epp/:id/foto — subir foto referencial
router.post('/:id/foto', authorize('administrador'), upload.single('foto'), async (req, res) => {
  try {
    const epp = await db.getAsync('SELECT * FROM epp_catalogo WHERE id = ?', [req.params.id]);
    if (!epp) return res.status(404).json({ error: 'EPP no encontrado' });
    if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });

    // Eliminar foto anterior si existe
    if (epp.foto_catalogo) {
      const fotoAnterior = path.join(__dirname, '../', epp.foto_catalogo);
      if (fs.existsSync(fotoAnterior)) fs.unlinkSync(fotoAnterior);
    }

    const fotoPath = 'uploads/' + req.file.filename;
    await db.runAsync('UPDATE epp_catalogo SET foto_catalogo = ? WHERE id = ?', [fotoPath, req.params.id]);
    const actualizado = await db.getAsync('SELECT * FROM epp_catalogo WHERE id = ?', [req.params.id]);
    res.json(actualizado);
  } catch (err) {
    console.error('[EPP] POST /:id/foto:', err);
    res.status(500).json({ error: 'Error al subir foto' });
  }
});

// POST /api/epp/:id/certificado — subir certificado técnico PDF
router.post('/:id/certificado', authorize('administrador', 'bodega'), upload.single('certificado'), async (req, res) => {
  try {
    const epp = await db.getAsync('SELECT * FROM epp_catalogo WHERE id = ?', [req.params.id]);
    if (!epp) return res.status(404).json({ error: 'EPP no encontrado' });
    if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });
    if (req.file.mimetype !== 'application/pdf') {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Solo se aceptan archivos PDF' });
    }

    // Eliminar certificado anterior si existe
    if (epp.certificado_tecnico) {
      const certAnterior = path.join(__dirname, '../', epp.certificado_tecnico);
      if (fs.existsSync(certAnterior)) fs.unlinkSync(certAnterior);
    }

    const certPath = 'uploads/' + req.file.filename;
    await db.runAsync('UPDATE epp_catalogo SET certificado_tecnico = ? WHERE id = ?', [certPath, req.params.id]);
    const actualizado = await db.getAsync('SELECT * FROM epp_catalogo WHERE id = ?', [req.params.id]);
    res.json(actualizado);
  } catch (err) {
    console.error('[EPP] POST /:id/certificado:', err);
    res.status(500).json({ error: 'Error al subir certificado' });
  }
});

// POST /api/epp/:id/ingreso-stock — registrar ingreso de stock
router.post('/:id/ingreso-stock', authorize('administrador', 'bodega'), async (req, res) => {
  const { cantidad, referencia, observacion } = req.body;
  const cantidadNum = parseInt(cantidad, 10);
  if (!cantidad || isNaN(cantidadNum) || cantidadNum <= 0) {
    return res.status(400).json({ error: 'La cantidad debe ser un número entero mayor a 0' });
  }

  try {
    const epp = await db.getAsync('SELECT * FROM epp_catalogo WHERE id = ?', [req.params.id]);
    if (!epp) return res.status(404).json({ error: 'EPP no encontrado' });

    const stockAnterior = epp.stock_actual;
    const stockResultante = stockAnterior + cantidadNum;

    await db.runAsync('BEGIN TRANSACTION');
    try {
      await db.runAsync(
        'UPDATE epp_catalogo SET stock_actual = stock_actual + ? WHERE id = ?',
        [cantidadNum, req.params.id]
      );
      await db.runAsync(
        `INSERT INTO stock_movimientos
           (epp_id, tipo, cantidad, stock_anterior, stock_resultante, referencia, usuario_id, fecha, observacion)
         VALUES (?, 'ingreso', ?, ?, ?, ?, ?, datetime('now'), ?)`,
        [req.params.id, cantidadNum, stockAnterior, stockResultante, referencia || null, req.user.id, observacion || null]
      );
      await db.runAsync('COMMIT');
    } catch (txErr) {
      await db.runAsync('ROLLBACK');
      throw txErr;
    }

    const actualizado = await db.getAsync('SELECT * FROM epp_catalogo WHERE id = ?', [req.params.id]);
    res.json(actualizado);
  } catch (err) {
    console.error('[EPP] POST /:id/ingreso-stock:', err);
    res.status(500).json({ error: 'Error al registrar ingreso de stock' });
  }
});

module.exports = router;
