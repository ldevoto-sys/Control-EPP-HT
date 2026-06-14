const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Calcula estado_vencimiento y dias_para_vencer a partir de fecha_vencimiento
function calcularEstadoVencimiento(fechaVencimiento) {
  if (!fechaVencimiento) return { dias_para_vencer: null, estado_vencimiento: 'vigente' };
  const hoy = new Date();
  const vence = new Date(fechaVencimiento);
  const diffMs = vence - hoy;
  const dias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  let estado_vencimiento;
  if (dias < 0) {
    estado_vencimiento = 'vencido';
  } else if (dias < 30) {
    estado_vencimiento = 'por_vencer';
  } else {
    estado_vencimiento = 'vigente';
  }
  return { dias_para_vencer: dias, estado_vencimiento };
}

// GET / — todas las asignaciones activas
router.get('/', authorize('administrador', 'consulta'), async (req, res) => {
  try {
    const rows = await db.allAsync(`
      SELECT aa.*,
        u.nombre AS trabajador_nombre, u.rut AS trabajador_rut,
        ec.nombre AS epp_nombre, ec.categoria, ec.unidad
      FROM asignaciones_activas aa
      JOIN users u ON u.id = aa.trabajador_id
      JOIN epp_catalogo ec ON ec.id = aa.epp_id
      ORDER BY u.nombre ASC, ec.nombre ASC
    `);

    const resultado = rows.map(r => ({
      ...r,
      ...calcularEstadoVencimiento(r.fecha_vencimiento)
    }));

    res.json(resultado);
  } catch (err) {
    console.error('[Asignaciones] GET /:', err);
    res.status(500).json({ error: 'Error al obtener asignaciones' });
  }
});

// GET /matriz — datos para tabla trabajador × EPP
router.get('/matriz', authorize('administrador', 'consulta', 'autorizador'), async (req, res) => {
  try {
    const trabajadores = await db.allAsync(
      'SELECT id, nombre, rut FROM users WHERE activo = 1 ORDER BY nombre ASC'
    );
    const epps = await db.allAsync(
      'SELECT id, nombre, categoria FROM epp_catalogo WHERE activo = 1 ORDER BY categoria ASC, nombre ASC'
    );
    const asignacionesRaw = await db.allAsync(`
      SELECT aa.*,
        e.pdf_firmado, e.pdf_entrega
      FROM asignaciones_activas aa
      LEFT JOIN entregas_epp e ON e.id = aa.entrega_id
    `);

    const asignaciones = asignacionesRaw.map(a => {
      const { dias_para_vencer, estado_vencimiento } = calcularEstadoVencimiento(a.fecha_vencimiento);
      return {
        trabajador_id: a.trabajador_id,
        epp_id: a.epp_id,
        entrega_id: a.entrega_id,
        cantidad: a.cantidad,
        fecha_asignacion: a.fecha_asignacion,
        fecha_vencimiento: a.fecha_vencimiento,
        dias_para_vencer,
        estado_vencimiento,
        pdf_firmado: a.pdf_firmado,
        pdf_entrega: a.pdf_entrega
      };
    });

    res.json({ trabajadores, epps, asignaciones });
  } catch (err) {
    console.error('[Asignaciones] GET /matriz:', err);
    res.status(500).json({ error: 'Error al obtener matriz de asignaciones' });
  }
});

// GET /trabajador/:id — EPP asignado a un trabajador + historial de entregas
router.get('/trabajador/:id', async (req, res) => {
  try {
    const trabajador = await db.getAsync(
      'SELECT id, nombre, rut, rol FROM users WHERE id = ?',
      [req.params.id]
    );
    if (!trabajador) return res.status(404).json({ error: 'Trabajador no encontrado' });

    const asignaciones = await db.allAsync(`
      SELECT aa.*,
        ec.nombre AS epp_nombre, ec.categoria, ec.unidad
      FROM asignaciones_activas aa
      JOIN epp_catalogo ec ON ec.id = aa.epp_id
      WHERE aa.trabajador_id = ?
      ORDER BY ec.nombre ASC
    `, [req.params.id]);

    const asignacionesConEstado = asignaciones.map(a => ({
      ...a,
      ...calcularEstadoVencimiento(a.fecha_vencimiento)
    }));

    const historialEntregas = await db.allAsync(`
      SELECT e.id, e.fecha_entrega, e.observacion, e.pdf_entrega, e.pdf_firmado, e.solicitud_id,
        u.nombre AS bodeguero_nombre
      FROM entregas_epp e
      LEFT JOIN users u ON u.id = e.bodeguero_id
      WHERE e.trabajador_id = ?
      ORDER BY e.fecha_entrega DESC
    `, [req.params.id]);

    for (const entrega of historialEntregas) {
      entrega.items = await db.allAsync(`
        SELECT ei.cantidad, ei.numero_serie, ec.nombre AS epp_nombre
        FROM entrega_items ei
        JOIN epp_catalogo ec ON ec.id = ei.epp_id
        WHERE ei.entrega_id = ?
      `, [entrega.id]);
    }

    res.json({
      trabajador,
      asignaciones: asignacionesConEstado,
      historial_entregas: historialEntregas
    });
  } catch (err) {
    console.error('[Asignaciones] GET /trabajador/:id:', err);
    res.status(500).json({ error: 'Error al obtener asignaciones del trabajador' });
  }
});

module.exports = router;
