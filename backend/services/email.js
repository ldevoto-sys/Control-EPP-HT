const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.SMTP_FROM || 'HidroTecnica EPP <hidrotecnica14@gmail.com>';
const APP_URL = process.env.APP_URL || 'http://localhost:3001';

async function enviar(to, subject, html) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return; // Sin config SMTP, silencioso
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
  } catch (e) {
    console.error('[email] Error enviando a', to, ':', e.message);
  }
}

// Template base
function template(titulo, contenido) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #112548; color: white; padding: 20px 24px;">
        <h1 style="margin: 0; font-size: 18px;">HidroTecnica SpA</h1>
        <p style="margin: 4px 0 0; font-size: 13px; color: #34B3DE;">Sistema de Control EPP</p>
      </div>
      <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
        <h2 style="color: #112548; margin-top: 0;">${titulo}</h2>
        ${contenido}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
        <p style="color: #555; font-size: 12px; margin: 0;">
          Este correo fue generado automáticamente por el Sistema de Control EPP de HidroTecnica SpA.
        </p>
      </div>
    </div>
  `;
}

module.exports = {
  // Usuario creado
  bienvenida: (user, passwordTemporal) => enviar(
    user.email,
    'Bienvenido al Sistema EPP HidroTecnica',
    template('Tu cuenta ha sido creada', `
      <p>Hola <strong>${user.nombre}</strong>,</p>
      <p>Tu cuenta en el Sistema de Control EPP ha sido creada con el rol <strong>${user.rol}</strong>.</p>
      <p><strong>Credenciales de acceso:</strong></p>
      <ul>
        <li>Email: ${user.email}</li>
        <li>Contraseña temporal: <code style="background:#f3f4f6;padding:2px 6px;border-radius:3px;">${passwordTemporal}</code></li>
      </ul>
      <p>Deberás cambiar tu contraseña al primer ingreso.</p>
      <a href="${APP_URL}/login" style="display:inline-block;background:#112548;color:white;padding:10px 20px;border-radius:4px;text-decoration:none;margin-top:8px;">Ingresar al sistema</a>
    `)
  ),

  // Solicitud enviada
  solicitudEnviada: (solicitante, trabajador, solicitudId, autorizadores) => {
    const html = template('Nueva solicitud de EPP', `
      <p><strong>${solicitante.nombre}</strong> ha enviado una solicitud de EPP (N° ${solicitudId}) para el trabajador <strong>${trabajador.nombre}</strong>.</p>
      <a href="${APP_URL}/solicitudes/${solicitudId}" style="display:inline-block;background:#112548;color:white;padding:10px 20px;border-radius:4px;text-decoration:none;margin-top:8px;">Revisar solicitud</a>
    `);
    const destinatarios = [solicitante.email, ...autorizadores.map(a => a.email)].filter(Boolean);
    return enviar(destinatarios.join(','), `Solicitud EPP N° ${solicitudId} — Pendiente de autorización`, html);
  },

  // Solicitud aprobada
  solicitudAprobada: (solicitante, trabajador, solicitudId) => enviar(
    [solicitante.email, trabajador.email].filter((e, i, a) => e && a.indexOf(e) === i).join(','),
    `Solicitud EPP N° ${solicitudId} aprobada`,
    template('Solicitud aprobada', `
      <p>La solicitud de EPP N° <strong>${solicitudId}</strong> para <strong>${trabajador.nombre}</strong> ha sido <strong style="color:#16a34a;">aprobada</strong>.</p>
      <p>El área de bodega procederá con la entrega.</p>
    `)
  ),

  // Solicitud rechazada
  solicitudRechazada: (solicitante, solicitudId, comentario) => enviar(
    solicitante.email,
    `Solicitud EPP N° ${solicitudId} rechazada`,
    template('Solicitud rechazada', `
      <p>La solicitud de EPP N° <strong>${solicitudId}</strong> ha sido <strong style="color:#dc2626;">rechazada</strong>.</p>
      ${comentario ? `<p><strong>Motivo:</strong> ${comentario}</p>` : ''}
    `)
  ),

  // EPP entregado
  eppEntregado: (trabajador, entregaId, items) => enviar(
    trabajador.email,
    'Registro de entrega de EPP',
    template('EPP entregado', `
      <p>Hola <strong>${trabajador.nombre}</strong>,</p>
      <p>Se ha registrado la entrega de los siguientes EPP:</p>
      <ul>${items.map(i => `<li>${i.epp_nombre} — Cantidad: ${i.cantidad}</li>`).join('')}</ul>
      <a href="${APP_URL}/asignaciones" style="display:inline-block;background:#112548;color:white;padding:10px 20px;border-radius:4px;text-decoration:none;margin-top:8px;">Ver mis EPP</a>
    `)
  ),

  // Stock crítico
  stockCritico: (adminEmail, epps) => enviar(
    adminEmail,
    'Alerta: EPP con stock crítico',
    template('Stock crítico', `
      <p>Los siguientes EPP están por debajo del stock mínimo:</p>
      <ul>${epps.map(e => `<li><strong>${e.nombre}</strong>: stock actual ${e.stock_actual} / mínimo ${e.stock_minimo}</li>`).join('')}</ul>
    `)
  ),

  // Contraseña cambiada
  passwordCambiada: (user) => enviar(
    user.email,
    'Tu contraseña fue cambiada',
    template('Contraseña actualizada', `
      <p>Hola <strong>${user.nombre}</strong>,</p>
      <p>Tu contraseña del Sistema EPP fue cambiada exitosamente.</p>
      <p>Si no fuiste tú, contacta al administrador de inmediato.</p>
    `)
  ),

  // Reset de contraseña
  resetPassword: (user, token) => enviar(
    user.email,
    'Recuperar contraseña — Sistema EPP',
    template('Recuperar contraseña', `
      <p>Hola <strong>${user.nombre}</strong>,</p>
      <p>Solicitaste restablecer tu contraseña. El link es válido por 1 hora.</p>
      <a href="${APP_URL}/reset-password/${token}" style="display:inline-block;background:#112548;color:white;padding:10px 20px;border-radius:4px;text-decoration:none;margin-top:8px;">Restablecer contraseña</a>
      <p style="color:#555;font-size:12px;margin-top:16px;">Si no solicitaste esto, ignora este correo.</p>
    `)
  ),
};
