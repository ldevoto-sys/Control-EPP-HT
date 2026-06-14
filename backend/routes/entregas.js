const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const email = require('../services/email');

const uploadsDir = process.env.RAILWAY_VOLUME_MOUNT_PATH ? require('path').join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'uploads') : require('path').join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authenticate);

// GET /pendientes — solicitudes aprobadas sin entrega registrada
router.get('/pendientes', authorize('bodega', 'administrador'), async (req, res) => {
  try {
    const rows = await db.allAsync(`
      SELECT s.*,
        u1.nombre AS solicitante_nombre,
        u2.nombre AS trabajador_nombre, u2.rut AS trabajador_rut,
        (SELECT COUNT(*) FROM solicitud_items si WHERE si.solicitud_id = s.id) AS items_count
      FROM solicitudes_epp s
      JOIN users u1 ON u1.id = s.solicitante_id
      JOIN users u2 ON u2.id = s.trabajador_id
      WHERE s.estado = 'aprobada'
        AND s.id NOT IN (SELECT solicitud_id FROM entregas_epp WHERE solicitud_id IS NOT NULL)
      ORDER BY s.fecha_resolucion ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error('[Entregas] GET /pendientes:', err);
    res.status(500).json({ error: 'Error al obtener entregas pendientes' });
  }
});

// POST /directa — entrega sin solicitud previa
router.post('/directa', authorize('bodega', 'autorizador', 'administrador'), upload.any(), async (req, res) => {
  const { trabajador_id, observacion } = req.body;
  const fecha_entrega = req.body.fecha_entrega || new Date().toISOString().split('T')[0];

  if (!trabajador_id) return res.status(400).json({ error: 'trabajador_id es requerido' });

  let items;
  try {
    items = JSON.parse(req.body.items || '[]');
  } catch {
    return res.status(400).json({ error: 'items debe ser un JSON válido' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items es requerido y no puede estar vacío' });
  }

  // Mapear archivos subidos por nombre
  const fileMap = {};
  if (req.files) {
    for (const f of req.files) {
      fileMap[f.fieldname] = f;
    }
  }

  await db.runAsync('BEGIN TRANSACTION');
  try {
    const trabajador = await db.getAsync('SELECT * FROM users WHERE id = ? AND activo = 1', [trabajador_id]);
    if (!trabajador) {
      await db.runAsync('ROLLBACK');
      return res.status(404).json({ error: 'Trabajador no encontrado o inactivo' });
    }

    const fotoFile = fileMap['foto'];
    const fotoRuta = fotoFile ? `/uploads/${fotoFile.filename}` : null;

    const entregaResult = await db.runAsync(
      `INSERT INTO entregas_epp (solicitud_id, trabajador_id, bodeguero_id, fecha_entrega, observacion, foto_entrega)
       VALUES (NULL, ?, ?, ?, ?, ?)`,
      [trabajador_id, req.user.id, fecha_entrega, observacion || null, fotoRuta]
    );
    const entregaId = entregaResult.lastID;
    const itemsConNombre = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.epp_id || !item.cantidad) {
        await db.runAsync('ROLLBACK');
        return res.status(400).json({ error: `Item ${i}: epp_id y cantidad son requeridos` });
      }

      const certFile = fileMap[`certificado_${i}`] || fileMap[`certificados_${i}`];
      const certRuta = certFile ? `/uploads/${certFile.filename}` : null;

      const epp = await db.getAsync('SELECT * FROM epp_catalogo WHERE id = ?', [item.epp_id]);
      if (!epp) {
        await db.runAsync('ROLLBACK');
        return res.status(404).json({ error: `EPP id=${item.epp_id} no encontrado` });
      }

      let fechaVencimiento = null;
      if (epp.vida_util_meses) {
        const fechaBase = new Date(fecha_entrega);
        fechaBase.setMonth(fechaBase.getMonth() + epp.vida_util_meses);
        fechaVencimiento = fechaBase.toISOString().split('T')[0];
      }

      if (epp.stock_actual < item.cantidad) {
        await db.runAsync('ROLLBACK');
        return res.status(400).json({ error: `Stock insuficiente para '${epp.nombre}': disponible=${epp.stock_actual}, solicitado=${item.cantidad}` });
      }

      await db.runAsync(
        `INSERT INTO entrega_items (entrega_id, epp_id, cantidad, numero_serie, fecha_vencimiento, certificado_adjunto)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [entregaId, item.epp_id, item.cantidad, item.numero_serie || null, fechaVencimiento, certRuta]
      );
      itemsConNombre.push({ epp_nombre: epp.nombre, cantidad: item.cantidad });

      const stockAnterior = epp.stock_actual;
      const stockResultante = stockAnterior - item.cantidad;

      await db.runAsync(
        'UPDATE epp_catalogo SET stock_actual = ? WHERE id = ?',
        [stockResultante, item.epp_id]
      );

      await db.runAsync(
        `INSERT INTO stock_movimientos
           (epp_id, tipo, cantidad, stock_anterior, stock_resultante, referencia, usuario_id, fecha)
         VALUES (?, 'egreso', ?, ?, ?, ?, ?, ?)`,
        [item.epp_id, -item.cantidad, stockAnterior, stockResultante, `Entrega directa #${entregaId}`, req.user.id, fecha_entrega]
      );

      const asignacion = await db.getAsync(
        'SELECT * FROM asignaciones_activas WHERE trabajador_id = ? AND epp_id = ?',
        [trabajador_id, item.epp_id]
      );

      if (asignacion) {
        await db.runAsync(
          `UPDATE asignaciones_activas
           SET cantidad = cantidad + ?, fecha_asignacion = ?, fecha_vencimiento = ?, entrega_id = ?
           WHERE trabajador_id = ? AND epp_id = ?`,
          [item.cantidad, fecha_entrega, fechaVencimiento, entregaId, trabajador_id, item.epp_id]
        );
      } else {
        await db.runAsync(
          `INSERT INTO asignaciones_activas (trabajador_id, epp_id, cantidad, fecha_asignacion, fecha_vencimiento, entrega_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [trabajador_id, item.epp_id, item.cantidad, fecha_entrega, fechaVencimiento, entregaId]
        );
      }
    }

    await db.runAsync('COMMIT');

    // Notificar al trabajador por email (async, no bloquea la respuesta)
    email.eppEntregado(trabajador, entregaId, itemsConNombre);

    res.status(201).json({ id: entregaId, message: 'Entrega registrada correctamente' });
  } catch (err) {
    await db.runAsync('ROLLBACK');
    console.error('[Entregas] POST /directa:', err);
    res.status(500).json({ error: 'Error al registrar entrega directa' });
  }
});

// GET /:id — detalle de una entrega con sus items
router.get('/:id', async (req, res) => {
  try {
    const entrega = await db.getAsync(`
      SELECT e.*,
        u1.nombre AS bodeguero_nombre,
        u2.nombre AS trabajador_nombre, u2.rut AS trabajador_rut
      FROM entregas_epp e
      JOIN users u1 ON u1.id = e.bodeguero_id
      JOIN users u2 ON u2.id = e.trabajador_id
      WHERE e.id = ?
    `, [req.params.id]);

    if (!entrega) return res.status(404).json({ error: 'Entrega no encontrada' });

    const items = await db.allAsync(`
      SELECT ei.*, ec.nombre AS epp_nombre, ec.unidad, ec.categoria
      FROM entrega_items ei
      JOIN epp_catalogo ec ON ec.id = ei.epp_id
      WHERE ei.entrega_id = ?
    `, [req.params.id]);

    res.json({ ...entrega, items });
  } catch (err) {
    console.error('[Entregas] GET /:id:', err);
    res.status(500).json({ error: 'Error al obtener entrega' });
  }
});

// POST / — registrar entrega física
router.post('/', authorize('bodega', 'administrador'), upload.any(), async (req, res) => {
  const { solicitud_id, observacion, fecha_entrega } = req.body;

  if (!solicitud_id) return res.status(400).json({ error: 'solicitud_id es requerido' });
  if (!fecha_entrega) return res.status(400).json({ error: 'fecha_entrega es requerido' });

  let items;
  try {
    items = JSON.parse(req.body.items || '[]');
  } catch {
    return res.status(400).json({ error: 'items debe ser un JSON válido' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items es requerido y no puede estar vacío' });
  }

  // Mapear archivos subidos por nombre
  const fileMap = {};
  if (req.files) {
    for (const f of req.files) {
      fileMap[f.fieldname] = f;
    }
  }

  await db.runAsync('BEGIN TRANSACTION');
  try {
    const solicitud = await db.getAsync('SELECT * FROM solicitudes_epp WHERE id = ?', [solicitud_id]);
    if (!solicitud) {
      await db.runAsync('ROLLBACK');
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    if (solicitud.estado !== 'aprobada') {
      await db.runAsync('ROLLBACK');
      return res.status(400).json({ error: `La solicitud debe estar en estado 'aprobada', estado actual: '${solicitud.estado}'` });
    }

    const fotoFile = fileMap['foto'];
    const fotoRuta = fotoFile ? `/uploads/${fotoFile.filename}` : null;

    const entregaResult = await db.runAsync(
      `INSERT INTO entregas_epp (solicitud_id, trabajador_id, bodeguero_id, fecha_entrega, observacion, foto_entrega)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [solicitud_id, solicitud.trabajador_id, req.user.id, fecha_entrega, observacion || null, fotoRuta]
    );
    const entregaId = entregaResult.lastID;
    const itemsConNombre = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.epp_id || !item.cantidad) {
        await db.runAsync('ROLLBACK');
        return res.status(400).json({ error: `Item ${i}: epp_id y cantidad son requeridos` });
      }

      // Buscar certificado adjunto
      const certFile = fileMap[`certificado_${i}`] || fileMap[`certificados_${i}`];
      const certRuta = certFile ? `/uploads/${certFile.filename}` : null;

      // Calcular fecha_vencimiento
      const epp = await db.getAsync('SELECT * FROM epp_catalogo WHERE id = ?', [item.epp_id]);
      if (!epp) {
        await db.runAsync('ROLLBACK');
        return res.status(404).json({ error: `EPP id=${item.epp_id} no encontrado` });
      }

      let fechaVencimiento = null;
      if (epp.vida_util_meses) {
        const fechaBase = new Date(fecha_entrega);
        fechaBase.setMonth(fechaBase.getMonth() + epp.vida_util_meses);
        fechaVencimiento = fechaBase.toISOString().split('T')[0];
      }

      // Validar stock suficiente
      if (epp.stock_actual < item.cantidad) {
        await db.runAsync('ROLLBACK');
        return res.status(400).json({ error: `Stock insuficiente para '${epp.nombre}': disponible=${epp.stock_actual}, solicitado=${item.cantidad}` });
      }

      await db.runAsync(
        `INSERT INTO entrega_items (entrega_id, epp_id, cantidad, numero_serie, fecha_vencimiento, certificado_adjunto)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [entregaId, item.epp_id, item.cantidad, item.numero_serie || null, fechaVencimiento, certRuta]
      );
      itemsConNombre.push({ epp_nombre: epp.nombre, cantidad: item.cantidad });

      const stockAnterior = epp.stock_actual;
      const stockResultante = stockAnterior - item.cantidad;

      await db.runAsync(
        'UPDATE epp_catalogo SET stock_actual = ? WHERE id = ?',
        [stockResultante, item.epp_id]
      );

      await db.runAsync(
        `INSERT INTO stock_movimientos
           (epp_id, tipo, cantidad, stock_anterior, stock_resultante, referencia, usuario_id, fecha)
         VALUES (?, 'egreso', ?, ?, ?, ?, ?, ?)`,
        [item.epp_id, -item.cantidad, stockAnterior, stockResultante, `Solicitud #${solicitud_id}`, req.user.id, fecha_entrega]
      );

      // Actualizar o insertar asignacion activa
      const asignacion = await db.getAsync(
        'SELECT * FROM asignaciones_activas WHERE trabajador_id = ? AND epp_id = ?',
        [solicitud.trabajador_id, item.epp_id]
      );

      if (asignacion) {
        await db.runAsync(
          `UPDATE asignaciones_activas
           SET cantidad = cantidad + ?, fecha_asignacion = ?, fecha_vencimiento = ?, entrega_id = ?
           WHERE trabajador_id = ? AND epp_id = ?`,
          [item.cantidad, fecha_entrega, fechaVencimiento, entregaId, solicitud.trabajador_id, item.epp_id]
        );
      } else {
        await db.runAsync(
          `INSERT INTO asignaciones_activas (trabajador_id, epp_id, cantidad, fecha_asignacion, fecha_vencimiento, entrega_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [solicitud.trabajador_id, item.epp_id, item.cantidad, fecha_entrega, fechaVencimiento, entregaId]
        );
      }
    }

    await db.runAsync(
      `UPDATE solicitudes_epp SET estado='entregada' WHERE id=?`,
      [solicitud_id]
    );

    await db.runAsync(
      `INSERT INTO solicitud_historial (solicitud_id, estado, usuario_id)
       VALUES (?, 'entregada', ?)`,
      [solicitud_id, req.user.id]
    );

    await db.runAsync('COMMIT');

    // Notificar al trabajador por email (async, no bloquea la respuesta)
    db.getAsync('SELECT nombre, email FROM users WHERE id=?', [solicitud.trabajador_id])
      .then(trabajador => {
        if (trabajador) {
          email.eppEntregado(trabajador, entregaId, itemsConNombre);
        }
      })
      .catch(() => {});

    res.status(201).json({ id: entregaId, message: 'Entrega registrada correctamente' });
  } catch (err) {
    await db.runAsync('ROLLBACK');
    console.error('[Entregas] POST /:', err);
    res.status(500).json({ error: 'Error al registrar entrega' });
  }
});

// POST /:id/pdf-firmado — subir PDF firmado
router.post('/:id/pdf-firmado', upload.single('pdf_firmado'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Archivo pdf_firmado requerido' });

  const ext = path.extname(req.file.originalname).toLowerCase();
  if (ext !== '.pdf') {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Solo se aceptan archivos PDF' });
  }

  try {
    const entrega = await db.getAsync('SELECT * FROM entregas_epp WHERE id = ?', [req.params.id]);
    if (!entrega) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Entrega no encontrada' });
    }

    // Eliminar PDF anterior si existe
    if (entrega.pdf_firmado) {
      const anteriorPath = path.join(__dirname, '../..', entrega.pdf_firmado);
      if (fs.existsSync(anteriorPath)) fs.unlinkSync(anteriorPath);
    }

    const rutaNueva = `/uploads/${req.file.filename}`;
    await db.runAsync(
      'UPDATE entregas_epp SET pdf_firmado = ? WHERE id = ?',
      [rutaNueva, req.params.id]
    );

    res.json({ message: 'PDF firmado guardado', pdf_firmado: rutaNueva });
  } catch (err) {
    console.error('[Entregas] POST /:id/pdf-firmado:', err);
    res.status(500).json({ error: 'Error al guardar PDF firmado' });
  }
});

// GET /:id/pdf — placeholder, generación real en services/pdf.js
router.get('/:id/pdf', async (req, res) => {
  try {
    const entrega = await db.getAsync(`
      SELECT e.*,
        u1.nombre AS bodeguero_nombre,
        u2.nombre AS trabajador_nombre, u2.rut AS trabajador_rut
      FROM entregas_epp e
      JOIN users u1 ON u1.id = e.bodeguero_id
      JOIN users u2 ON u2.id = e.trabajador_id
      WHERE e.id = ?
    `, [req.params.id]);

    if (!entrega) return res.status(404).json({ error: 'Entrega no encontrada' });

    const items = await db.allAsync(`
      SELECT ei.*, ec.nombre AS epp_nombre, ec.unidad, ec.categoria
      FROM entrega_items ei
      JOIN epp_catalogo ec ON ec.id = ei.epp_id
      WHERE ei.entrega_id = ?
    `, [req.params.id]);

    res.json({ entrega: { ...entrega, items }, _note: 'Generación de PDF disponible en la siguiente fase (services/pdf.js)' });
  } catch (err) {
    console.error('[Entregas] GET /:id/pdf:', err);
    res.status(500).json({ error: 'Error al obtener datos para PDF' });
  }
});

module.exports = router;
