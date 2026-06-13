const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { db } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

const APP_URL = process.env.APP_URL || 'http://localhost:5173';

function validarRut(rut) {
  const clean = rut.replace(/\./g, '').replace('-', '');
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1).toUpperCase();
  let sum = 0, factor = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const expected = 11 - (sum % 11);
  const dvCalc = expected === 11 ? '0' : expected === 10 ? 'K' : String(expected);
  return dv === dvCalc;
}

function crearTransporte() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// Todos los endpoints requieren autenticación
router.use(authenticate);

// GET /api/users
router.get('/', async (req, res) => {
  try {
    const users = await db.allAsync(
      'SELECT id, nombre, rut, email, rol, activo, created_at FROM users ORDER BY nombre'
    );
    res.json(users);
  } catch (err) {
    console.error('[users/GET /]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /api/users/trabajadores
router.get('/trabajadores', async (req, res) => {
  try {
    const users = await db.allAsync(
      'SELECT id, nombre, rut, rol FROM users WHERE activo = 1 ORDER BY nombre'
    );
    res.json(users);
  } catch (err) {
    console.error('[users/GET /trabajadores]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/users
router.post('/', authorize('administrador'), async (req, res) => {
  try {
    const { nombre, rut, email, rol } = req.body;
    if (!nombre || !rut || !email || !rol)
      return res.status(400).json({ error: 'Campos requeridos: nombre, rut, email, rol' });

    if (!validarRut(rut)) return res.status(400).json({ error: 'RUT inválido' });

    const emailExiste = await db.getAsync('SELECT id FROM users WHERE email = ?', [email]);
    if (emailExiste) return res.status(409).json({ error: 'El email ya está registrado' });

    const rutExiste = await db.getAsync('SELECT id FROM users WHERE rut = ?', [rut]);
    if (rutExiste) return res.status(409).json({ error: 'El RUT ya está registrado' });

    // Generar password temporal
    const passwordTemporal = crypto.randomBytes(6).toString('hex') + 'A1!';
    const hash = await bcrypt.hash(passwordTemporal, 10);

    const result = await db.runAsync(
      `INSERT INTO users (nombre, rut, email, password_hash, rol, must_change_password)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [nombre, rut, email, hash, rol]
    );

    // Enviar email de bienvenida
    try {
      const transporte = crearTransporte();
      await transporte.sendMail({
        from: process.env.SMTP_FROM || 'HidroTecnica EPP <hidrotecnica14@gmail.com>',
        to: email,
        subject: 'Bienvenido al Sistema Control EPP HidroTecnica',
        html: `
          <p>Hola ${nombre},</p>
          <p>Tu cuenta ha sido creada en el Sistema Control EPP HidroTecnica.</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Contraseña temporal:</strong> ${passwordTemporal}</p>
          <p>Al ingresar por primera vez deberás cambiar tu contraseña.</p>
          <p><a href="${APP_URL}">Ingresar al sistema</a></p>
        `,
      });
    } catch (smtpErr) {
      console.error('[users/POST] SMTP error:', smtpErr.message);
    }

    res.status(201).json({ id: result.lastID, nombre, rut, email, rol, activo: 1 });
  } catch (err) {
    console.error('[users/POST /]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// PUT /api/users/:id
router.put('/:id', authorize('administrador'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, rut, email, rol, activo } = req.body;

    if (!nombre || !rut || !email || !rol)
      return res.status(400).json({ error: 'Campos requeridos: nombre, rut, email, rol' });

    if (!validarRut(rut)) return res.status(400).json({ error: 'RUT inválido' });

    const user = await db.getAsync('SELECT id FROM users WHERE id = ?', [id]);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const emailExiste = await db.getAsync('SELECT id FROM users WHERE email = ? AND id != ?', [email, id]);
    if (emailExiste) return res.status(409).json({ error: 'El email ya está registrado por otro usuario' });

    const rutExiste = await db.getAsync('SELECT id FROM users WHERE rut = ? AND id != ?', [rut, id]);
    if (rutExiste) return res.status(409).json({ error: 'El RUT ya está registrado por otro usuario' });

    await db.runAsync(
      'UPDATE users SET nombre = ?, rut = ?, email = ?, rol = ?, activo = ? WHERE id = ?',
      [nombre, rut, email, rol, activo !== undefined ? activo : 1, id]
    );

    res.json({ message: 'Usuario actualizado correctamente' });
  } catch (err) {
    console.error('[users/PUT /:id]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// DELETE /api/users/:id (soft delete)
router.delete('/:id', authorize('administrador'), async (req, res) => {
  try {
    const { id } = req.params;

    if (parseInt(id) === req.user.id)
      return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });

    const user = await db.getAsync('SELECT id FROM users WHERE id = ?', [id]);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    await db.runAsync('UPDATE users SET activo = 0 WHERE id = ?', [id]);

    res.json({ message: 'Usuario desactivado correctamente' });
  } catch (err) {
    console.error('[users/DELETE /:id]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
