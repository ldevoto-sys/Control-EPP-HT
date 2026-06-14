const express = require('express');
const router = express.Router();

const { authenticate, authorize } = require('../middleware/auth');
const { db } = require('../db');

// Todos los endpoints requieren autenticación
router.use(authenticate);

// GET /api/stock — estado actual de stock
router.get('/', authorize('administrador', 'bodega', 'consulta'), async (req, res) => {
  try {
    const rows = await db.allAsync(`
      SELECT id, id AS epp_id, nombre, nombre AS epp_nombre,
             categoria, descripcion, unidad, vida_util_meses,
             stock_actual, stock_minimo, activo, foto_catalogo, certificado_tecnico, created_at
      FROM epp_catalogo
      ORDER BY categoria ASC, nombre ASC
    `);
    const resultado = rows.map(epp => ({
      ...epp,
      stock_critico: epp.stock_actual <= epp.stock_minimo
    }));
    res.json(resultado);
  } catch (err) {
    console.error('[Stock] GET /:', err);
    res.status(500).json({ error: 'Error al obtener estado de stock' });
  }
});

// GET /api/stock/critico — solo EPP con stock crítico. DEBE ir antes de /:epp_id/movimientos
router.get('/critico', authorize('administrador', 'bodega', 'consulta'), async (req, res) => {
  try {
    const rows = await db.allAsync(`
      SELECT id, nombre, categoria, descripcion, unidad, vida_util_meses,
             stock_actual, stock_minimo, activo, foto_catalogo, certificado_tecnico, created_at
      FROM epp_catalogo
      WHERE stock_actual <= stock_minimo
      ORDER BY categoria ASC, nombre ASC
    `);
    const resultado = rows.map(epp => ({ ...epp, stock_critico: true }));
    res.json(resultado);
  } catch (err) {
    console.error('[Stock] GET /critico:', err);
    res.status(500).json({ error: 'Error al obtener stock crítico' });
  }
});

// GET /api/stock/:epp_id/movimientos — historial de movimientos de un EPP
router.get('/:epp_id/movimientos', authorize('administrador', 'bodega'), async (req, res) => {
  try {
    const epp = await db.getAsync('SELECT id, nombre FROM epp_catalogo WHERE id = ?', [req.params.epp_id]);
    if (!epp) return res.status(404).json({ error: 'EPP no encontrado' });

    const movimientos = await db.allAsync(`
      SELECT sm.id, sm.tipo, sm.cantidad, sm.stock_anterior, sm.stock_resultante,
             sm.referencia, sm.observacion, sm.fecha, sm.created_at,
             u.nombre AS usuario_nombre, u.rol AS usuario_rol
      FROM stock_movimientos sm
      LEFT JOIN users u ON sm.usuario_id = u.id
      WHERE sm.epp_id = ?
      ORDER BY sm.fecha DESC
      LIMIT 100
    `, [req.params.epp_id]);

    res.json({ epp, movimientos });
  } catch (err) {
    console.error('[Stock] GET /:epp_id/movimientos:', err);
    res.status(500).json({ error: 'Error al obtener movimientos' });
  }
});

// POST /api/stock/ajuste — ajuste manual de stock
router.post('/ajuste', authorize('administrador'), async (req, res) => {
  const { epp_id, stock_nuevo, observacion } = req.body;
  const stockNuevoNum = parseInt(stock_nuevo, 10);
  if (epp_id === undefined || epp_id === null) {
    return res.status(400).json({ error: 'epp_id es requerido' });
  }
  if (stock_nuevo === undefined || stock_nuevo === null || isNaN(stockNuevoNum) || stockNuevoNum < 0) {
    return res.status(400).json({ error: 'stock_nuevo debe ser un número entero mayor o igual a 0' });
  }

  try {
    const epp = await db.getAsync('SELECT * FROM epp_catalogo WHERE id = ?', [epp_id]);
    if (!epp) return res.status(404).json({ error: 'EPP no encontrado' });

    const stockAnterior = epp.stock_actual;
    const diferencia = stockNuevoNum - stockAnterior;

    await db.runAsync('BEGIN TRANSACTION');
    try {
      await db.runAsync(
        'UPDATE epp_catalogo SET stock_actual = ? WHERE id = ?',
        [stockNuevoNum, epp_id]
      );
      await db.runAsync(
        `INSERT INTO stock_movimientos
           (epp_id, tipo, cantidad, stock_anterior, stock_resultante, referencia, usuario_id, fecha, observacion)
         VALUES (?, 'ajuste', ?, ?, ?, NULL, ?, datetime('now'), ?)`,
        [epp_id, diferencia, stockAnterior, stockNuevoNum, req.user.id, observacion || null]
      );
      await db.runAsync('COMMIT');
    } catch (txErr) {
      await db.runAsync('ROLLBACK');
      throw txErr;
    }

    const actualizado = await db.getAsync('SELECT * FROM epp_catalogo WHERE id = ?', [epp_id]);
    res.json({
      ...actualizado,
      stock_critico: actualizado.stock_actual <= actualizado.stock_minimo
    });
  } catch (err) {
    console.error('[Stock] POST /ajuste:', err);
    res.status(500).json({ error: 'Error al registrar ajuste de stock' });
  }
});

module.exports = router;
