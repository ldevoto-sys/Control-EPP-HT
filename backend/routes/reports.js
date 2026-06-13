'use strict';

const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const {
  generarPdfEntrega,
  generarPdfTrabajador,
  generarPdfEntregaConCertificados,
} = require('../services/pdf');

router.use(authenticate);

// ─── GET /trabajador/:id/pdf ─────────────────────────────────────────────────
// PDF completo del historial EPP de un trabajador. Todos los roles.
router.get('/trabajador/:id/pdf', async (req, res) => {
  try {
    const trabajadorId = parseInt(req.params.id, 10);
    if (isNaN(trabajadorId)) return res.status(400).json({ error: 'ID inválido' });

    const buffer = await generarPdfTrabajador(trabajadorId, db);

    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="epp_trabajador_${trabajadorId}.pdf"`,
      'Content-Length':      buffer.length,
    });
    res.send(buffer);
  } catch (err) {
    console.error('[reports] PDF trabajador:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /entrega/:id/pdf ────────────────────────────────────────────────────
// PDF de una entrega específica (con certificados adjuntos si existen). Todos los roles.
router.get('/entrega/:id/pdf', async (req, res) => {
  try {
    const entregaId = parseInt(req.params.id, 10);
    if (isNaN(entregaId)) return res.status(400).json({ error: 'ID inválido' });

    const buffer = await generarPdfEntregaConCertificados(entregaId, db);

    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="epp_entrega_${entregaId}.pdf"`,
      'Content-Length':      buffer.length,
    });
    res.send(buffer);
  } catch (err) {
    console.error('[reports] PDF entrega:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /stock-critico ──────────────────────────────────────────────────────
// EPP con stock_actual <= stock_minimo. Roles: administrador, bodega.
router.get('/stock-critico', authorize('administrador', 'bodega'), async (req, res) => {
  try {
    const rows = await db.allAsync(
      `SELECT id, nombre, categoria, unidad, stock_actual, stock_minimo,
              (stock_minimo - stock_actual) AS deficit
       FROM epp_catalogo
       WHERE stock_actual <= stock_minimo AND activo = 1
       ORDER BY deficit DESC, nombre`
    );
    res.json({ total: rows.length, items: rows });
  } catch (err) {
    console.error('[reports] stock-critico:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /vencimientos ───────────────────────────────────────────────────────
// EPP próximos a vencer (próximos 60 días) y ya vencidos. Roles: administrador, bodega.
router.get('/vencimientos', authorize('administrador', 'bodega'), async (req, res) => {
  try {
    const hoy = new Date().toISOString().split('T')[0];
    const en60 = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const rows = await db.allAsync(
      `SELECT aa.id, aa.trabajador_id, aa.epp_id, aa.cantidad,
              aa.fecha_asignacion, aa.fecha_vencimiento,
              ec.nombre AS epp_nombre, ec.categoria,
              u.nombre  AS trabajador_nombre, u.rut AS trabajador_rut
       FROM asignaciones_activas aa
       JOIN epp_catalogo ec ON ec.id = aa.epp_id
       JOIN users u         ON u.id  = aa.trabajador_id
       WHERE aa.fecha_vencimiento IS NOT NULL
         AND aa.fecha_vencimiento <= ?
       ORDER BY aa.fecha_vencimiento`,
      [en60]
    );

    const proximos_a_vencer = rows.filter((r) => r.fecha_vencimiento > hoy);
    const vencidos          = rows.filter((r) => r.fecha_vencimiento <= hoy);

    res.json({ proximos_a_vencer, vencidos });
  } catch (err) {
    console.error('[reports] vencimientos:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /matriz-csv ─────────────────────────────────────────────────────────
// Matriz trabajador × EPP en CSV. Roles: administrador, consulta.
router.get('/matriz-csv', authorize('administrador', 'consulta'), async (req, res) => {
  try {
    // Todos los trabajadores con asignaciones activas
    const trabajadores = await db.allAsync(
      `SELECT DISTINCT u.id, u.nombre, u.rut
       FROM users u
       JOIN asignaciones_activas aa ON aa.trabajador_id = u.id
       WHERE u.activo = 1
       ORDER BY u.nombre`
    );

    // Todos los EPP con asignaciones activas
    const epps = await db.allAsync(
      `SELECT DISTINCT ec.id, ec.nombre
       FROM epp_catalogo ec
       JOIN asignaciones_activas aa ON aa.epp_id = ec.id
       ORDER BY ec.nombre`
    );

    // Todas las asignaciones
    const asignaciones = await db.allAsync(
      `SELECT trabajador_id, epp_id, fecha_asignacion
       FROM asignaciones_activas`
    );

    // Índice rápido: "trabajadorId_eppId" → fecha_asignacion
    const idx = {};
    asignaciones.forEach((a) => {
      idx[`${a.trabajador_id}_${a.epp_id}`] = a.fecha_asignacion;
    });

    // Construir CSV
    const encabezado = ['Trabajador', 'RUT', ...epps.map((e) => e.nombre)];
    const csvLines = [encabezado.map(csvEscape).join(',')];

    trabajadores.forEach((t) => {
      const fila = [
        t.nombre,
        t.rut,
        ...epps.map((e) => {
          const val = idx[`${t.id}_${e.id}`];
          return val ? formatDateSimple(val) : '';
        }),
      ];
      csvLines.push(fila.map(csvEscape).join(','));
    });

    const csv = csvLines.join('\r\n');

    res.set({
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="epp_matriz.csv"',
    });
    res.send('﻿' + csv); // BOM para que Excel abra bien en español
  } catch (err) {
    console.error('[reports] matriz-csv:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Helpers CSV ─────────────────────────────────────────────────────────────

function csvEscape(val) {
  const s = val == null ? '' : String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function formatDateSimple(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-CL');
  } catch {
    return dateStr;
  }
}

module.exports = router;
