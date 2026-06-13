const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { db } = require('../db');
const { authenticate } = require('../middleware/auth');
const email = require('../services/email');

const JWT_SECRET = process.env.JWT_SECRET || 'eppHT_dev_secret';

function validarPassword(p) {
  return p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[^A-Za-z0-9]/.test(p);
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y password requeridos' });

    const user = await db.getAsync('SELECT * FROM users WHERE email = ? AND activo = 1', [email]);
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

    const payload = {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      must_change_password: user.must_change_password,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

    res.json({ token, user: payload });
  } catch (err) {
    console.error('[auth/login]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { password_actual, password_nueva } = req.body;
    if (!password_actual || !password_nueva)
      return res.status(400).json({ error: 'Campos requeridos' });

    const user = await db.getAsync('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const ok = await bcrypt.compare(password_actual, user.password_hash);
    if (!ok) return res.status(400).json({ error: 'Password actual incorrecto' });

    if (!validarPassword(password_nueva))
      return res.status(400).json({
        error: 'La nueva password debe tener al menos 8 caracteres, una mayúscula, una minúscula y un carácter especial',
      });

    const hash = await bcrypt.hash(password_nueva, 10);
    await db.runAsync(
      'UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?',
      [hash, req.user.id]
    );

    await email.passwordCambiada(req.user);
    res.json({ message: 'Password actualizado correctamente' });
  } catch (err) {
    console.error('[auth/change-password]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requerido' });

    const user = await db.getAsync('SELECT * FROM users WHERE email = ? AND activo = 1', [email]);

    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 3600000).toISOString(); // 1 hora

      await db.runAsync(
        'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
        [token, expires, user.id]
      );

        await email.resetPassword(user, token);
    }

    // Siempre responder 200 para no revelar si el email existe
    res.json({ message: 'Si el email existe, recibirás instrucciones para restablecer tu contraseña.' });
  } catch (err) {
    console.error('[auth/forgot-password]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/auth/reset-password/:token
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password_nueva } = req.body;

    if (!password_nueva) return res.status(400).json({ error: 'Password requerida' });

    const user = await db.getAsync(
      'SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > ?',
      [token, new Date().toISOString()]
    );

    if (!user) return res.status(400).json({ error: 'Token inválido o expirado' });

    if (!validarPassword(password_nueva))
      return res.status(400).json({
        error: 'La password debe tener al menos 8 caracteres, una mayúscula, una minúscula y un carácter especial',
      });

    const hash = await bcrypt.hash(password_nueva, 10);
    await db.runAsync(
      'UPDATE users SET password_hash = ?, must_change_password = 0, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
      [hash, user.id]
    );

    res.json({ message: 'Password restablecida correctamente' });
  } catch (err) {
    console.error('[auth/reset-password]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
