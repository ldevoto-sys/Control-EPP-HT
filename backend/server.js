const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// Directorio uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Archivos estáticos de uploads
app.use('/uploads', express.static(uploadsDir));

// Rutas API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));

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
