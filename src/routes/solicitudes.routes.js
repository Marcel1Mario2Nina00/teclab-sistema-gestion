const express = require('express');
const {
    listarCatalogo,
    crearSolicitud,
    listarSolicitudes,
    listarLaboratoristas,
    asignarLaboratorista
} = require('../controllers/solicitudes.controller');
const { verificarToken, permitirRoles } = require('../middlewares/auth.middleware');

const router = express.Router();

// Catálogo disponible para cualquier usuario autenticado
router.get('/catalogo', verificarToken, listarCatalogo);

// Listar laboratoristas disponibles (solo Recepcionista)
router.get('/laboratoristas', verificarToken, permitirRoles('Recepcionista'), listarLaboratoristas);

// Solo médicos pueden crear nuevas solicitudes
router.post('/', verificarToken, permitirRoles('Médico', 'Medico'), crearSolicitud);

// Listar solicitudes según el rol del usuario autenticado
router.get('/', verificarToken, listarSolicitudes);

// Asignar solicitud a un laboratorista (solo Recepcionista)
router.put('/:id/asignar', verificarToken, permitirRoles('Recepcionista'), asignarLaboratorista);

module.exports = router; 