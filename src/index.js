const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Importar Rutas
const authRoutes = require('./routes/auth.routes');
const centrosRoutes = require('./routes/centros.routes');
const medicosRoutes = require('./routes/medicos.routes');
const solicitudesRoutes = require('./routes/solicitudes.routes');

// Usar Rutas
app.use('/api/auth', authRoutes);
app.use('/api/centros', centrosRoutes);
app.use('/api/medicos', medicosRoutes);
app.use('/api/solicitudes', solicitudesRoutes); 
// Ruta de prueba
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Servidor TECLAB funcionando' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
});