'use strict';

const PDFDocument = require('pdfkit');
const { PDFDocument: LibPDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

// Colores corporativos HidroTecnica
const NAVY  = '#112548';
const CYAN  = '#34B3DE';
const GRAY  = '#555555';
const LIGHT = '#f0f7fb';
const WHITE = '#FFFFFF';

// ─── Helpers ────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

function setFill(doc, hex) {
  const { r, g, b } = hexToRgb(hex);
  doc.fillColor(hex);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function estadoVencimiento(fechaVencimiento) {
  if (!fechaVencimiento) return { texto: 'Vigente', color: '#166534' };
  const hoy = new Date();
  const vence = new Date(fechaVencimiento);
  const diff = (vence - hoy) / (1000 * 60 * 60 * 24);
  if (diff > 30)  return { texto: 'Vigente',     color: '#166534' };
  if (diff > 0)   return { texto: 'Por vencer',  color: '#92400e' };
  return              { texto: 'Vencido',     color: '#991b1b' };
}

/**
 * Construye un Buffer a partir de un PDFDocument de pdfkit
 */
function pdfkitToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data',  (c) => chunks.push(c));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

// ─── Header corporativo ──────────────────────────────────────────────────────

function dibujarHeader(doc, subtitulo, extra) {
  // Rectángulo NAVY
  doc.rect(0, 0, doc.page.width, 60).fill(NAVY);

  // Línea de acento CYAN
  doc.rect(0, 60, doc.page.width, 3).fill(CYAN);

  // Textos del header
  doc.fillColor(WHITE)
     .font('Helvetica-Bold')
     .fontSize(16)
     .text('HidroTecnica SpA', 40, 12, { align: 'left' });

  doc.font('Helvetica')
     .fontSize(11)
     .text(subtitulo, 40, 34, { align: 'left' });

  if (extra) {
    doc.font('Helvetica-Bold')
       .fontSize(10)
       .text(extra, 0, 20, { align: 'right', width: doc.page.width - 40 });
  }

  doc.y = 80;
}

// ─── Footer en cada página ───────────────────────────────────────────────────

function agregarFooters(doc) {
  const range = doc.bufferedPageRange();
  const total = range.count;
  for (let i = 0; i < total; i++) {
    doc.switchToPage(range.start + i);
    doc.fillColor(GRAY)
       .font('Helvetica')
       .fontSize(9)
       .text(
         `Página ${i + 1} de ${total}`,
         0,
         doc.page.height - 30,
         { align: 'center', width: doc.page.width }
       );
  }
}

// ─── Tabla genérica ──────────────────────────────────────────────────────────

function dibujarTabla(doc, columnas, filas, startY) {
  const margin = 40;
  const pageWidth = doc.page.width - margin * 2;
  const totalParts = columnas.reduce((s, c) => s + c.width, 0);
  const rowH = 20;
  const headerH = 22;

  let y = startY || doc.y;

  // Encabezado
  doc.rect(margin, y, pageWidth, headerH).fill(NAVY);
  let x = margin;
  columnas.forEach((col) => {
    const w = (col.width / totalParts) * pageWidth;
    doc.fillColor(WHITE)
       .font('Helvetica-Bold')
       .fontSize(9)
       .text(col.label, x + 4, y + 6, { width: w - 8, ellipsis: true });
    x += w;
  });
  y += headerH;

  // Filas
  filas.forEach((fila, idx) => {
    // Salto de página si necesario
    if (y + rowH > doc.page.height - 50) {
      doc.addPage();
      y = doc.y;
    }

    const bg = idx % 2 === 0 ? WHITE : LIGHT;
    doc.rect(margin, y, pageWidth, rowH).fill(bg);

    let cx = margin;
    columnas.forEach((col) => {
      const w = (col.width / totalParts) * pageWidth;
      const val = fila[col.key] !== undefined && fila[col.key] !== null ? String(fila[col.key]) : '—';
      doc.fillColor(GRAY)
         .font('Helvetica')
         .fontSize(8)
         .text(val, cx + 4, y + 5, { width: w - 8, ellipsis: true });
      cx += w;
    });
    y += rowH;
  });

  doc.y = y + 6;
}

// ─── Bloque de datos ─────────────────────────────────────────────────────────

function bloqueInfo(doc, campos) {
  const margin = 40;
  const pageWidth = doc.page.width - margin * 2;
  const startY = doc.y + 4;
  const h = campos.length * 18 + 12;

  doc.rect(margin, startY, pageWidth, h).fill(LIGHT);
  doc.rect(margin, startY, 3, h).fill(CYAN);

  campos.forEach(([label, valor], i) => {
    const y = startY + 8 + i * 18;
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(9)
       .text(label, margin + 10, y, { continued: true });
    doc.fillColor(GRAY).font('Helvetica').fontSize(9)
       .text('  ' + (valor || '—'));
  });

  doc.y = startY + h + 10;
}

// ─── Función 1: PDF de una entrega ───────────────────────────────────────────

async function generarPdfEntrega(entregaId, db) {
  const entrega = await db.getAsync(
    `SELECT e.*,
       u1.nombre AS trabajador_nombre, u1.rut AS trabajador_rut,
       u2.nombre AS bodeguero_nombre
     FROM entregas_epp e
     JOIN users u1 ON u1.id = e.trabajador_id
     JOIN users u2 ON u2.id = e.bodeguero_id
     WHERE e.id = ?`,
    [entregaId]
  );

  if (!entrega) throw new Error(`Entrega ${entregaId} no encontrada`);

  const items = await db.allAsync(
    `SELECT ei.*, ec.nombre AS epp_nombre, ec.categoria
     FROM entrega_items ei
     JOIN epp_catalogo ec ON ec.id = ei.epp_id
     WHERE ei.entrega_id = ?`,
    [entregaId]
  );

  const doc = new PDFDocument({ margin: 0, bufferPages: true });

  // Header
  dibujarHeader(doc, 'Comprobante de Entrega EPP');

  // Bloque datos trabajador
  doc.y += 4;
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(11)
     .text('Datos del Trabajador', 40, doc.y);
  doc.y += 4;

  bloqueInfo(doc, [
    ['Trabajador:',        entrega.trabajador_nombre],
    ['RUT:',               entrega.trabajador_rut],
    ['Fecha de entrega:',  formatDate(entrega.fecha_entrega)],
    ['Registrado por:',    entrega.bodeguero_nombre],
  ]);

  // Tabla EPP entregados
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(11)
     .text('EPP Entregados', 40, doc.y);
  doc.y += 6;

  dibujarTabla(doc,
    [
      { label: 'EPP',       key: 'epp_nombre',        width: 3 },
      { label: 'Categoría', key: 'categoria',          width: 2 },
      { label: 'Cantidad',  key: 'cantidad',           width: 1 },
      { label: 'N° Serie',  key: 'numero_serie',       width: 2 },
      { label: 'Vence',     key: 'fecha_vencimiento_fmt', width: 2 },
    ],
    items.map((it) => ({
      ...it,
      fecha_vencimiento_fmt: formatDate(it.fecha_vencimiento),
    }))
  );

  // Observación
  if (entrega.observacion) {
    doc.y += 6;
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(10)
       .text('Observación:', 40, doc.y);
    doc.fillColor(GRAY).font('Helvetica').fontSize(9)
       .text(entrega.observacion, 40, doc.y + 2, {
         width: doc.page.width - 80,
         lineGap: 2,
       });
    doc.y += 18;
  }

  // Sección firma
  const firmaY = Math.max(doc.y + 30, doc.page.height - 160);
  doc.rect(40, firmaY, doc.page.width - 80, 1).fill(CYAN);

  doc.y = firmaY + 12;
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(10)
     .text('Firma del trabajador:', 40, doc.y);

  // Línea de firma
  doc.rect(200, firmaY + 40, 200, 0.5).fill(GRAY);
  doc.fillColor(GRAY).font('Helvetica').fontSize(9)
     .text('Firma', 200, firmaY + 44);

  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(9)
     .text('RUT:', 40, firmaY + 55, { continued: true });
  doc.fillColor(GRAY).font('Helvetica').fontSize(9)
     .text('  ' + entrega.trabajador_rut);

  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(9)
     .text('Fecha:', 40, firmaY + 70, { continued: true });
  doc.fillColor(GRAY).font('Helvetica').fontSize(9)
     .text('  ' + formatDate(entrega.fecha_entrega));

  // Foto de entrega (página 2)
  if (entrega.foto_entrega) {
    const fotoPath = path.join(__dirname, '../uploads', path.basename(entrega.foto_entrega));
    if (fs.existsSync(fotoPath)) {
      doc.addPage({ margin: 40 });
      dibujarHeader(doc, 'Comprobante de Entrega EPP — Fotografía');

      doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(11)
         .text('Fotografía de entrega', 40, doc.y + 8);
      doc.y += 24;

      const imgX = (doc.page.width - 400) / 2;
      doc.image(fotoPath, imgX, doc.y, { fit: [400, 300] });
      doc.y += 312;

      doc.fillColor(GRAY).font('Helvetica').fontSize(9)
         .text(`Entrega N° ${entregaId} — ${formatDate(entrega.fecha_entrega)}`,
               40, doc.y, { align: 'center', width: doc.page.width - 80 });
    }
  }

  agregarFooters(doc);
  return pdfkitToBuffer(doc);
}

// ─── Función 2: PDF completo historial trabajador ────────────────────────────

async function generarPdfTrabajador(trabajadorId, db) {
  const trabajador = await db.getAsync(
    `SELECT id, nombre, rut FROM users WHERE id = ?`,
    [trabajadorId]
  );
  if (!trabajador) throw new Error(`Trabajador ${trabajadorId} no encontrado`);

  const asignaciones = await db.allAsync(
    `SELECT aa.*, ec.nombre AS epp_nombre, ec.categoria,
       e.fecha_entrega
     FROM asignaciones_activas aa
     JOIN epp_catalogo ec ON ec.id = aa.epp_id
     LEFT JOIN entregas_epp e ON e.id = aa.entrega_id
     WHERE aa.trabajador_id = ?
     ORDER BY ec.categoria, ec.nombre`,
    [trabajadorId]
  );

  const historialEntregas = await db.allAsync(
    `SELECT e.*, GROUP_CONCAT(ec.nombre, ', ') AS epps_nombres
     FROM entregas_epp e
     JOIN entrega_items ei ON ei.entrega_id = e.id
     JOIN epp_catalogo ec ON ec.id = ei.epp_id
     WHERE e.trabajador_id = ?
     GROUP BY e.id
     ORDER BY e.fecha_entrega DESC`,
    [trabajadorId]
  );

  const doc = new PDFDocument({ margin: 0, bufferPages: true });

  // ── Página 1: Resumen ──
  dibujarHeader(
    doc,
    'Historial EPP Trabajador',
    `${trabajador.nombre} | ${trabajador.rut}`
  );

  // Sección asignaciones actuales
  doc.y += 8;
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(12)
     .text('EPP Asignado Actualmente', 40, doc.y);
  doc.y += 8;

  if (asignaciones.length === 0) {
    doc.fillColor(GRAY).font('Helvetica').fontSize(10)
       .text('Sin asignaciones activas.', 40, doc.y);
    doc.y += 20;
  } else {
    // Tabla con columna estado como texto
    const margin = 40;
    const pageWidth = doc.page.width - margin * 2;
    const cols = [
      { label: 'EPP',            key: 'epp_nombre',       width: 3 },
      { label: 'Categoría',      key: 'categoria',         width: 2 },
      { label: 'Cantidad',       key: 'cantidad',          width: 1 },
      { label: 'Fecha Entrega',  key: 'fecha_entrega_fmt', width: 2 },
      { label: 'Vence',          key: 'fecha_venc_fmt',    width: 2 },
      { label: 'Estado',         key: 'estado',            width: 2 },
    ];
    const totalParts = cols.reduce((s, c) => s + c.width, 0);
    const rowH = 20;
    const headerH = 22;

    let y = doc.y;
    doc.rect(margin, y, pageWidth, headerH).fill(NAVY);
    let cx = margin;
    cols.forEach((col) => {
      const w = (col.width / totalParts) * pageWidth;
      doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(9)
         .text(col.label, cx + 4, y + 6, { width: w - 8, ellipsis: true });
      cx += w;
    });
    y += headerH;

    asignaciones.forEach((asi, idx) => {
      if (y + rowH > doc.page.height - 50) {
        doc.addPage();
        y = 40;
      }
      const estado = estadoVencimiento(asi.fecha_vencimiento);
      const bg = idx % 2 === 0 ? WHITE : LIGHT;
      doc.rect(margin, y, pageWidth, rowH).fill(bg);

      const fila = {
        epp_nombre:      asi.epp_nombre,
        categoria:       asi.categoria,
        cantidad:        asi.cantidad,
        fecha_entrega_fmt: formatDate(asi.fecha_entrega),
        fecha_venc_fmt:  formatDate(asi.fecha_vencimiento),
        estado:          '',
      };

      let rx = margin;
      cols.forEach((col) => {
        const w = (col.width / totalParts) * pageWidth;
        if (col.key === 'estado') {
          doc.fillColor(estado.color).font('Helvetica-Bold').fontSize(8)
             .text(estado.texto, rx + 4, y + 5, { width: w - 8, ellipsis: true });
        } else {
          const val = fila[col.key] !== undefined ? String(fila[col.key]) : '—';
          doc.fillColor(GRAY).font('Helvetica').fontSize(8)
             .text(val, rx + 4, y + 5, { width: w - 8, ellipsis: true });
        }
        rx += w;
      });
      y += rowH;
    });

    doc.y = y + 10;
  }

  // Sección historial de entregas
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(12)
     .text('Historial de Entregas', 40, doc.y + 4);
  doc.y += 14;

  if (historialEntregas.length === 0) {
    doc.fillColor(GRAY).font('Helvetica').fontSize(10)
       .text('Sin entregas registradas.', 40, doc.y);
    doc.y += 20;
  } else {
    historialEntregas.forEach((ent) => {
      if (doc.y > doc.page.height - 80) doc.addPage();
      doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(9)
         .text(`Entrega N° ${ent.id} — ${formatDate(ent.fecha_entrega)}`, 40, doc.y, { continued: true });
      doc.fillColor(GRAY).font('Helvetica').fontSize(9)
         .text(`  ${ent.epps_nombres || '—'}`);
      doc.y += 4;
    });
  }

  // ── Páginas siguientes: comprobantes (2 por página) ──
  let compCount = 0;

  for (const ent of historialEntregas) {
    const items = await db.allAsync(
      `SELECT ei.*, ec.nombre AS epp_nombre, ec.categoria
       FROM entrega_items ei
       JOIN epp_catalogo ec ON ec.id = ei.epp_id
       WHERE ei.entrega_id = ?`,
      [ent.id]
    );

    // Abrir nueva página o sección según posición
    if (compCount % 2 === 0) {
      doc.addPage({ margin: 40 });
      dibujarHeader(doc, `Comprobantes — ${trabajador.nombre}`);
    } else {
      // Línea divisoria a mitad de página
      doc.rect(40, doc.y + 8, doc.page.width - 80, 1).fill(CYAN);
      doc.y += 18;
    }

    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(10)
       .text(`Entrega N° ${ent.id} — ${formatDate(ent.fecha_entrega)}`, 40, doc.y);
    doc.y += 6;

    dibujarTabla(doc,
      [
        { label: 'EPP',       key: 'epp_nombre',           width: 3 },
        { label: 'Categoría', key: 'categoria',             width: 2 },
        { label: 'Cantidad',  key: 'cantidad',              width: 1 },
        { label: 'N° Serie',  key: 'numero_serie',          width: 2 },
        { label: 'Vence',     key: 'fecha_vencimiento_fmt', width: 2 },
      ],
      items.map((it) => ({
        ...it,
        fecha_vencimiento_fmt: formatDate(it.fecha_vencimiento),
      }))
    );

    if (ent.observacion) {
      doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(9)
         .text('Obs: ', 40, doc.y, { continued: true });
      doc.fillColor(GRAY).font('Helvetica').fontSize(9)
         .text(ent.observacion);
      doc.y += 4;
    }

    // Foto
    if (ent.foto_entrega) {
      const fotoPath = path.join(__dirname, '../uploads', path.basename(ent.foto_entrega));
      if (fs.existsSync(fotoPath)) {
        doc.image(fotoPath, 40, doc.y, { fit: [200, 150] });
        doc.y += 158;
      }
    }

    compCount++;
  }

  agregarFooters(doc);
  return pdfkitToBuffer(doc);
}

// ─── Función 3: PDF entrega + certificados concatenados ─────────────────────

async function generarPdfEntregaConCertificados(entregaId, db) {
  // 1. Generar PDF principal con pdfkit → Buffer
  const pdfPrincipal = await generarPdfEntrega(entregaId, db);

  // 2. Obtener items con certificado
  const items = await db.allAsync(
    `SELECT ei.certificado_adjunto, ec.nombre AS epp_nombre
     FROM entrega_items ei
     JOIN epp_catalogo ec ON ec.id = ei.epp_id
     WHERE ei.entrega_id = ? AND ei.certificado_adjunto IS NOT NULL`,
    [entregaId]
  );

  if (items.length === 0) return pdfPrincipal;

  // 3. Usar pdf-lib para concatenar
  const mergedPdf = await LibPDFDocument.create();

  // Copiar páginas del PDF principal
  const mainDoc = await LibPDFDocument.load(pdfPrincipal);
  const mainPages = await mergedPdf.copyPages(mainDoc, mainDoc.getPageIndices());
  mainPages.forEach((p) => mergedPdf.addPage(p));

  // Copiar páginas de cada certificado
  for (const item of items) {
    try {
      const certPath = path.join(__dirname, '../uploads', path.basename(item.certificado_adjunto));
      if (fs.existsSync(certPath)) {
        const certBytes = fs.readFileSync(certPath);
        const certDoc = await LibPDFDocument.load(certBytes);
        const certPages = await mergedPdf.copyPages(certDoc, certDoc.getPageIndices());
        certPages.forEach((p) => mergedPdf.addPage(p));
      }
    } catch (_e) {
      // Si falla un certificado, continuar con los demás
    }
  }

  const mergedBytes = await mergedPdf.save();
  return Buffer.from(mergedBytes);
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  generarPdfEntrega,
  generarPdfTrabajador,
  generarPdfEntregaConCertificados,
};
