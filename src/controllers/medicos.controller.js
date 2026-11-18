const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Registrar un médico en un centro aprobado
const registrarMedico = async (req, res) => {
    try {
        const { centro_id, nombre_completo, telefono, especialidad, username, password } = req.body;

        // 1. Verificar que el centro médico exista y esté Aprobado
        const centro = await prisma.centros_medicos.findUnique({
            where: { id: parseInt(centro_id) }
        });

        if (!centro) {
            return res.status(404).json({ message: 'Centro médico no encontrado' });
        }

        if (centro.estado !== 'Aprobado') {
            return res.status(403).json({ 
                message: 'El centro médico debe estar Aprobado para registrar médicos' 
            });
        }

        // 2. Verificar que el username no esté en uso
        const usuarioExistente = await prisma.usuarios.findUnique({
            where: { username }
        });

        if (usuarioExistente) {
            return res.status(400).json({ message: 'El nombre de usuario ya está registrado' });
        }

        // 3. Buscar el rol de Médico en la tabla roles
        const rolMedico = await prisma.roles.findFirst({
            where: {
                OR: [{ nombre: 'Médico' }, { nombre: 'Medico' }]
            }
        });

        if (!rolMedico) {
            return res.status(500).json({ message: 'No se encontró el rol Médico en la base de datos' });
        }

        // 4. Encriptar la contraseña
        const password_hash = await bcrypt.hash(password, 10);

        // 5. Transacción atómica: crear usuario + crear médico
        const resultado = await prisma.$transaction(async (tx) => {
            const nuevoUsuario = await tx.usuarios.create({
                data: {
                    username,
                    password_hash,
                    rol_id: rolMedico.id,
                    estado: 'Activo'
                }
            });

            const nuevoMedico = await tx.medicos.create({
                data: {
                    usuario_id: nuevoUsuario.id,
                    centro_id: parseInt(centro_id),
                    nombre_completo,
                    telefono,
                    especialidad
                }
            });

            return { nuevoUsuario, nuevoMedico };
        });

        res.status(201).json({
            message: 'Médico registrado exitosamente',
            medico: {
                id: resultado.nuevoMedico.id,
                nombre_completo: resultado.nuevoMedico.nombre_completo,
                especialidad: resultado.nuevoMedico.especialidad,
                username: resultado.nuevoUsuario.username,
                centro_id: resultado.nuevoMedico.centro_id
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al registrar el médico' });
    }
};

// Listar médicos de un centro específico
const listarMedicosPorCentro = async (req, res) => {
    try {
        const { centro_id } = req.params;

        const medicos = await prisma.medicos.findMany({
            where: { centro_id: parseInt(centro_id) },
            include: {
                usuarios: {
                    select: { username: true, estado: true }
                }
            }
        });

        res.json(medicos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener los médicos del centro' });
    }
};

module.exports = { registrarMedico, listarMedicosPorCentro };