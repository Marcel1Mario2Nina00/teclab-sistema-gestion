const express = require('express');
const { registrarMedico, listarMedicosPorCentro } = require('../controllers/medicos.controller');

const router = express.Router();

router.post('/', registrarMedico);
router.get('/centro/:centro_id', listarMedicosPorCentro);

module.exports = router;