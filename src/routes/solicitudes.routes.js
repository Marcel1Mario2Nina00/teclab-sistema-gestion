const express = require('express');
const { 
    listarCatalogo, 
    crearSolicitud, 
    listarSolicitudes 
} = require('../controllers/solicitudes.controller');
const { verificarToken, permitirRoles } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/catalogo', verificarToken, listarCatalogo);

router.post('/', verificarToken, permitirRoles('Médico', 'Medico'), crearSolicitud);

router.get('/', verificarToken, listarSolicitudes);

module.exports = router;