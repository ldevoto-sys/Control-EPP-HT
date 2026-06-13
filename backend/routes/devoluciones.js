const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authenticate);

// GET / — lista devoluciones
router.get('/', authorize('administrador', 'consulta'), async (req, res) => {
  try {
    const rows = await db.allAsync(`
      SELECT d.*,
        u1.nombre AS trabajador_nombre, u1.rut AS trabajador_rut,
        u2.nombre AS registrado_por_nombre,
        ec.nombre AS epp_nombre, ec.categoria
      FROM devoluciones_epp d
      JOIN users u1 ON u1.id = d.trabajador_id
      JOIN users u2 ON u2.id = d.registrado_por_id
      JOIN epp_catalogo ec ON ec.id = d.epp_id
      ORDER BY d.fecha_devolucion DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('[Devoluciones] GET /:', err);
    res.status(500).json({ error: 'Error al obtener devoluciones' });
  }
});

// POST / — registrar devolución
router.post('/', authorize('bodega', 'administrador'), upload.single('foto'), async (req, res) => {
  const { trabajador_id, epp_id, cantidad, motivo, observacion, vuelve_a_stock, fecha_devolucion } = req.body;

  if (!trabajador_id) return res.status(400).json({ error: 'trabajador_id es requerido' });
  if (!epp_id) return res.status(400).json({ error: 'epp_id es requerido' });
  if (!cantidad || parseInt(cantidad) <= 0) return res.status(400).json({ error: 'cantidad debe ser mayor a 0' });
  if (!motivo) return res.status(400).json({ error: 'motivo es requerido' });
  if (!fecha_devolucion) return res.status(400).json({ error: 'fecha_devolucion es requerida' });

  const cantidadNum = parseInt(cantidad);
  const vuelveStock = parseInt(vuelve_a_stock) === 1 ? 1 : 0;
  const fotoRuta = req.file ? `/uploads/${req.file.filename}` : null;

  await db.runAsync('BEGIN TRANSACTION');
  try {
    const epp = await db.getAsync('SELECT * FROM epp_catalogo WHERE id = ?', [epp_id]);
    if (!epp) {
      await db.runAsync('ROLLBACK');
      return res.status(404).json({ error: 'EPP no encontrado' });
    }

    const result = await db.runAsync(
      `INSERT INTO devoluciones_epp
         (trabajador_id, epp_id, cantidad, motivo, registrado_por_id, fecha_devolucion, observacion, foto_devolucion, vuelve_a_stock)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [trabajador_id, epp_id, cantidadNum, motivo, req.user.id, fecha_devolucion, observacion || null, fotoRuta, vuelveStock]
    );
    const devolucionId = result.lastID;

    const stockAnterior = epp.stock_actual;

    if (vuelveStock === 1) {
      const stockResultante = stockAnterior + cantidadNum;
      await db.runAsync(
        'UPDATE epp_catalogo SET stock_actual = ? WHERE id = ?',
        [stockResultante, epp_id]
      );
      await db.runAsync(
        `INSERT INTO stock_movimientos
           (epp_id, tipo, cantidad, stock_anterior, stock_resultante, referencia, usuario_id, fecha)
         VALUES (?, 'devolucion', ?, ?, ?, ?, ?, ?)`,
        [epp_id, cantidadNum, stockAnterior, stockResultante, `Devolución #${devolucionId}`, req.user.id, fecha_devolucion]
      );
    } else {
      // No vuelve a stock: registrar como baja
      const stockResultante = stockAnterior;
      await db.runAsync(
        `INSERT INTO stock_movimientos
           (epp_id, tipo, cantidad, stock_anterior, stock_resultante, referencia, usuario_id, fecha)
         VALUES (?, 'baja', ?, ?, ?, ?, ?, ?)`,
        [epp_id, -cantidadNum, stockAnterior, stockResultante, `Baja por devolución #${devolucionId}`, req.user.id, fecha_devolucion]
      );
    }

    // Actualizar asignaciones_activas
    const asignacion = await db.getAsync(
      'SELECT * FROM asignaciones_activas WHERE trabajador_id = ? AND epp_id = ?',
      [trabajador_id, epp_id]
    );

    if (asignacion) {
      const nuevaCantidad = asignacion.cantidad - cantidadNum;
      if (nuevaCantidad <= 0) {
        await db.runAsync(
          'DELETE FROM asignaciones_activas WHERE trabajador_id = ? AND epp_id = ?',
          [trabajador_id, epp_id]
        );
      } else {
        await db.runAsync(
          'UPDATE asignaciones_activas SET cantidad = ? WHERE trabajador_id = ? AND epp_id = ?',
          [nuevaCantidad, trabajador_id, epp_id]
        );
      }
    }

    await db.runAsync('COMMIT');
    res.status(201).json({ id: devolucionId, message: 'Devolución registrada correctamente' });
  } catch (err) {
    await db.runAsync('ROLLBACK');
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('[Devoluciones] POST /:', err);
    res.status(500).json({ error: 'Error al registrar devolución' });
  }
});

module.exports = router;
