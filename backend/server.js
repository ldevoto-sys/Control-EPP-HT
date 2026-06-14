const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// Directorio uploads — en Railway usar volumen persistente
const uploadsDir = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'uploads')
  : path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Archivos estáticos de uploads
app.use('/uploads', express.static(uploadsDir));

// Health check (requerido por Railway)
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Rutas API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/epp', require('./routes/epp'));
app.use('/api/stock', require('./routes/stock'));
app.use('/api/solicitudes', require('./routes/solicitudes'));
app.use('/api/entregas', require('./routes/entregas'));
app.use('/api/asignaciones', require('./routes/asignaciones'));
app.use('/api/devoluciones', require('./routes/devoluciones'));
app.use('/api/reports',     require('./routes/reports'));

// Producción: servir frontend compilado
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '../frontend/dist');
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Iniciar
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[Server] Servidor corriendo en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[Server] Error al inicializar DB:', err);
    process.exit(1);
  });
