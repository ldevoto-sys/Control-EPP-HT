const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const email = require('../services/email');

router.use(authenticate);

// GET / — lista solicitudes filtradas por rol
router.get('/', async (req, res) => {
  try {
    let rows;
    if (req.user.rol === 'operador') {
      rows = await db.allAsync(`
        SELECT s.*,
          u1.nombre AS solicitante_nombre, u1.rut AS solicitante_rut,
          u2.nombre AS trabajador_nombre, u2.rut AS trabajador_rut
        FROM solicitudes_epp s
        JOIN users u1 ON u1.id = s.solicitante_id
        JOIN users u2 ON u2.id = s.trabajador_id
        WHERE s.solicitante_id = ?
        ORDER BY s.fecha_solicitud DESC
      `, [req.user.id]);
    } else {
      rows = await db.allAsync(`
        SELECT s.*,
          u1.nombre AS solicitante_nombre, u1.rut AS solicitante_rut,
          u2.nombre AS trabajador_nombre, u2.rut AS trabajador_rut
        FROM solicitudes_epp s
        JOIN users u1 ON u1.id = s.solicitante_id
        JOIN users u2 ON u2.id = s.trabajador_id
        ORDER BY s.fecha_solicitud DESC
      `);
    }
    res.json(rows);
  } catch (err) {
    console.error('[Solicitudes] GET /:', err);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
});

// GET /pendientes — solicitudes con estado='pendiente'
router.get('/pendientes', authorize('autorizador', 'administrador'), async (req, res) => {
  try {
    const rows = await db.allAsync(`
      SELECT s.*,
        u1.nombre AS solicitante_nombre, u1.rut AS solicitante_rut,
        u2.nombre AS trabajador_nombre, u2.rut AS trabajador_rut
      FROM solicitudes_epp s
      JOIN users u1 ON u1.id = s.solicitante_id
      JOIN users u2 ON u2.id = s.trabajador_id
      WHERE s.estado = 'pendiente'
      ORDER BY s.fecha_solicitud DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('[Solicitudes] GET /pendientes:', err);
    res.status(500).json({ error: 'Error al obtener solicitudes pendientes' });
  }
});

// GET /:id — una solicitud con sus items e historial
router.get('/:id', async (req, res) => {
  try {
    const solicitud = await db.getAsync(`
      SELECT s.*,
        u1.nombre AS solicitante_nombre, u1.rut AS solicitante_rut,
        u2.nombre AS trabajador_nombre, u2.rut AS trabajador_rut
      FROM solicitudes_epp s
      JOIN users u1 ON u1.id = s.solicitante_id
      JOIN users u2 ON u2.id = s.trabajador_id
      WHERE s.id = ?
    `, [req.params.id]);

    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });

    // Restricción: operador solo ve sus propias solicitudes
    if (req.user.rol === 'operador' && solicitud.solicitante_id !== req.user.id) {
      return res.status(403).json({ error: 'Sin permiso' });
    }

    const items = await db.allAsync(`
      SELECT si.*, ec.nombre AS epp_nombre, ec.unidad, ec.categoria
      FROM solicitud_items si
      JOIN epp_catalogo ec ON ec.id = si.epp_id
      WHERE si.solicitud_id = ?
    `, [req.params.id]);

    const historial = await db.allAsync(`
      SELECT sh.*, u.nombre AS usuario_nombre, u.rol AS usuario_rol
      FROM solicitud_historial sh
      JOIN users u ON u.id = sh.usuario_id
      WHERE sh.solicitud_id = ?
      ORDER BY sh.created_at ASC
    `, [req.params.id]);

    res.json({ ...solicitud, items, historial });
  } catch (err) {
    console.error('[Solicitudes] GET /:id:', err);
    res.status(500).json({ error: 'Error al obtener solicitud' });
  }
});

// POST / — crear solicitud
router.post('/', authorize('operador', 'autorizador', 'administrador'), async (req, res) => {
  const { trabajador_id, items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items es requerido y no puede estar vacío' });
  }
  if (!trabajador_id) {
    return res.status(400).json({ error: 'trabajador_id es requerido' });
  }

  await db.runAsync('BEGIN TRANSACTION');
  try {
    const result = await db.runAsync(
      `INSERT INTO solicitudes_epp (solicitante_id, trabajador_id, estado)
       VALUES (?, ?, 'pendiente')`,
      [req.user.id, trabajador_id]
    );
    const solicitudId = result.lastID;

    for (const item of items) {
      if (!item.epp_id || !item.cantidad || !item.motivo) {
        await db.runAsync('ROLLBACK');
        return res.status(400).json({ error: 'Cada item debe tener epp_id, cantidad y motivo' });
      }
      await db.runAsync(
        `INSERT INTO solicitud_items (solicitud_id, epp_id, cantidad, motivo)
         VALUES (?, ?, ?, ?)`,
        [solicitudId, item.epp_id, item.cantidad, item.motivo]
      );
    }

    await db.runAsync(
      `INSERT INTO solicitud_historial (solicitud_id, estado, usuario_id)
       VALUES (?, 'pendiente', ?)`,
      [solicitudId, req.user.id]
    );

    await db.runAsync('COMMIT');

    // Notificar por email (no bloquea la respuesta)
    try {
      const solicitante = await db.getAsync('SELECT id, nombre, email FROM users WHERE id = ?', [req.user.id]);
      const trabajador = await db.getAsync('SELECT id, nombre, email FROM users WHERE id = ?', [trabajador_id]);
      const autorizadores = await db.allAsync(
        "SELECT nombre, email FROM users WHERE rol IN ('autorizador', 'administrador') AND activo = 1"
      );
      await email.solicitudEnviada(solicitante, trabajador, solicitudId, autorizadores);
    } catch (emailErr) {
      console.error('[Solicitudes] email error:', emailErr.message);
    }

    res.status(201).json({ id: solicitudId, message: 'Solicitud creada correctamente' });
  } catch (err) {
    await db.runAsync('ROLLBACK');
    console.error('[Solicitudes] POST /:', err);
    res.status(500).json({ error: 'Error al crear solicitud' });
  }
});

// POST /:id/aprobar
router.post('/:id/aprobar', authorize('autorizador', 'administrador'), async (req, res) => {
  try {
    const solicitud = await db.getAsync('SELECT * FROM solicitudes_epp WHERE id = ?', [req.params.id]);
    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });
    if (solicitud.estado !== 'pendiente') {
      return res.status(400).json({ error: `No se puede aprobar una solicitud en estado '${solicitud.estado}'` });
    }
    if (req.user.id === solicitud.solicitante_id) {
      return res.status(403).json({ error: 'El autorizador no puede aprobar su propia solicitud' });
    }

    await db.runAsync('BEGIN TRANSACTION');
    try {
      await db.runAsync(
        `UPDATE solicitudes_epp
         SET estado='aprobada', autorizador_id=?, fecha_resolucion=datetime('now')
         WHERE id=?`,
        [req.user.id, req.params.id]
      );
      await db.runAsync(
        `INSERT INTO solicitud_historial (solicitud_id, estado, usuario_id)
         VALUES (?, 'aprobada', ?)`,
        [req.params.id, req.user.id]
      );
      await db.runAsync('COMMIT');
    } catch (txErr) {
      await db.runAsync('ROLLBACK');
      throw txErr;
    }

    // Notificar por email
    try {
      const solicitante = await db.getAsync('SELECT nombre, email FROM users WHERE id = ?', [solicitud.solicitante_id]);
      const trabajador = await db.getAsync('SELECT nombre, email FROM users WHERE id = ?', [solicitud.trabajador_id]);
      await email.solicitudAprobada(solicitante, trabajador, req.params.id);
    } catch (emailErr) {
      console.error('[Solicitudes/aprobar] email error:', emailErr.message);
    }

    res.json({ message: 'Solicitud aprobada' });
  } catch (err) {
    console.error('[Solicitudes] POST /:id/aprobar:', err);
    res.status(500).json({ error: 'Error al aprobar solicitud' });
  }
});

// POST /:id/rechazar
router.post('/:id/rechazar', authorize('autorizador', 'administrador'), async (req, res) => {
  const { comentario } = req.body;
  if (!comentario || comentario.trim() === '') {
    return res.status(400).json({ error: 'comentario es obligatorio para rechazar' });
  }

  try {
    const solicitud = await db.getAsync('SELECT * FROM solicitudes_epp WHERE id = ?', [req.params.id]);
    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });
    if (solicitud.estado !== 'pendiente') {
      return res.status(400).json({ error: `No se puede rechazar una solicitud en estado '${solicitud.estado}'` });
    }

    await db.runAsync('BEGIN TRANSACTION');
    try {
      await db.runAsync(
        `UPDATE solicitudes_epp
         SET estado='rechazada', comentario_autorizador=?, autorizador_id=?, fecha_resolucion=datetime('now')
         WHERE id=?`,
        [comentario, req.user.id, req.params.id]
      );
      await db.runAsync(
        `INSERT INTO solicitud_historial (solicitud_id, estado, usuario_id, comentario)
         VALUES (?, 'rechazada', ?, ?)`,
        [req.params.id, req.user.id, comentario]
      );
      await db.runAsync('COMMIT');
    } catch (txErr) {
      await db.runAsync('ROLLBACK');
      throw txErr;
    }

    // Notificar por email
    try {
      const solicitante = await db.getAsync('SELECT nombre, email FROM users WHERE id = ?', [solicitud.solicitante_id]);
      await email.solicitudRechazada(solicitante, req.params.id, comentario);
    } catch (emailErr) {
      console.error('[Solicitudes/rechazar] email error:', emailErr.message);
    }

    res.json({ message: 'Solicitud rechazada' });
  } catch (err) {
    console.error('[Solicitudes] POST /:id/rechazar:', err);
    res.status(500).json({ error: 'Error al rechazar solicitud' });
  }
});

// POST /:id/anular
router.post('/:id/anular', authorize('administrador'), async (req, res) => {
  try {
    const solicitud = await db.getAsync('SELECT * FROM solicitudes_epp WHERE id = ?', [req.params.id]);
    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });
    if (solicitud.estado === 'entregada') {
      return res.status(400).json({ error: 'No se puede anular una solicitud ya entregada' });
    }

    await db.runAsync('BEGIN TRANSACTION');
    try {
      await db.runAsync(
        `UPDATE solicitudes_epp
         SET estado='anulada', autorizador_id=?, fecha_resolucion=datetime('now')
         WHERE id=?`,
        [req.user.id, req.params.id]
      );
      await db.runAsync(
        `INSERT INTO solicitud_historial (solicitud_id, estado, usuario_id)
         VALUES (?, 'anulada', ?)`,
        [req.params.id, req.user.id]
      );
      await db.runAsync('COMMIT');
    } catch (txErr) {
      await db.runAsync('ROLLBACK');
      throw txErr;
    }

    res.json({ message: 'Solicitud anulada' });
  } catch (err) {
    console.error('[Solicitudes] POST /:id/anular:', err);
    res.status(500).json({ error: 'Error al anular solicitud' });
  }
});

// GET /:id/historial
router.get('/:id/historial', async (req, res) => {
  try {
    const solicitud = await db.getAsync('SELECT id, solicitante_id FROM solicitudes_epp WHERE id = ?', [req.params.id]);
    if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });

    if (req.user.rol === 'operador' && solicitud.solicitante_id !== req.user.id) {
      return res.status(403).json({ error: 'Sin permiso' });
    }

    const historial = await db.allAsync(`
      SELECT sh.*, u.nombre AS usuario_nombre, u.rol AS usuario_rol
      FROM solicitud_historial sh
      JOIN users u ON u.id = sh.usuario_id
      WHERE sh.solicitud_id = ?
      ORDER BY sh.created_at ASC
    `, [req.params.id]);

    res.json(historial);
  } catch (err) {
    console.error('[Solicitudes] GET /:id/historial:', err);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

module.exports = router;
