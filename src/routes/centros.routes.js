const express = require('express');
const multer = require('multer');
const { 
    solicitarSuscripcion, 
    listarPendientes, 
    cambiarEstado,
    listarCentros 
} = require('../controllers/centros.controller');

const router = express.Router();

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/cartas/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Rutas de la API
router.post('/suscribir', upload.single('carta'), solicitarSuscripcion);
router.get('/pendientes', listarPendientes);
router.put('/:id/estado', cambiarEstado);
router.get('/', listarCentros);

module.exports = router;