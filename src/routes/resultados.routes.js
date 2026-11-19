const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const {
    listarAnalisisPendientes,
    registrarResultado,
    obtenerResultadosPorSolicitud
} = require('../controllers/resultados.controller');
const { verificarToken, permitirRoles } = require('../middlewares/auth.middleware');

const router = express.Router();

// Asegurar que exista la carpeta uploads/resultados
const uploadDir = path.join('uploads', 'resultados');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuración de Multer para imágenes de resultados
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({ storage });

// Rutas protegidas
router.get('/pendientes', verificarToken, permitirRoles('Laboratorista'), listarAnalisisPendientes);
router.post('/', verificarToken, permitirRoles('Laboratorista'), upload.array('imagenes', 5), registrarResultado);
router.get('/solicitud/:solicitud_id', verificarToken, obtenerResultadosPorSolicitud);

module.exports = router;