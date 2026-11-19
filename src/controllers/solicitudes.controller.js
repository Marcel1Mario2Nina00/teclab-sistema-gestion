const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. Obtener el catálogo de categorías y tipos de análisis disponibles
const listarCatalogo = async (req, res) => {
    try {
        const catalogo = await prisma.categorias_analisis.findMany({
            include: {
                tipos_analisis: true
            }
        });
        res.json(catalogo);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener el catálogo de análisis' });
    }
};

// 2. Crear una nueva solicitud de análisis (solo Médicos autenticados)
const crearSolicitud = async (req, res) => {
    try {
        const { paciente, forma_obtencion, observaciones, tipos_analisis_ids } = req.body;

        // Validar que se hayan seleccionado análisis
        if (!tipos_analisis_ids || !Array.isArray(tipos_analisis_ids) || tipos_analisis_ids.length === 0) {
            return res.status(400).json({ message: 'Debe seleccionar al menos un tipo de análisis' });
        }

        // Buscar el perfil del médico a partir del usuario autenticado en el Token JWT
        const medico = await prisma.medicos.findUnique({
            where: { usuario_id: req.user.id }
        });

        if (!medico) {
            return res.status(404).json({ message: 'Perfil de médico no encontrado para este usuario' });
        }

        // Transacción: Buscar/Crear paciente + Crear solicitud + Crear detalles de análisis
        const nuevaSolicitud = await prisma.$transaction(async (tx) => {
            // Upsert: si el CI existe lo actualiza/usa, si no existe lo crea
            const pacienteRegistrado = await tx.pacientes.upsert({
                where: { ci: paciente.ci },
                update: {
                    nombre_completo: paciente.nombre_completo,
                    edad: paciente.edad ? parseInt(paciente.edad) : null,
                    sexo: paciente.sexo
                },
                create: {
                    ci: paciente.ci,
                    nombre_completo: paciente.nombre_completo,
                    edad: paciente.edad ? parseInt(paciente.edad) : null,
                    sexo: paciente.sexo
                }
            });

            // Crear la solicitud y sus detalles asociados
            return await tx.solicitudes.create({
                data: {
                    paciente_id: pacienteRegistrado.id,
                    medico_id: medico.id,
                    forma_obtencion, // 'Paciente_trae_muestra' o 'Laboratorio_recoge_muestra'
                    observaciones: observaciones || null,
                    estado_general: 'Pendiente',
                    detalles_solicitud: {
                        create: tipos_analisis_ids.map((tipoId) => ({
                            tipo_analisis_id: parseInt(tipoId),
                            estado_analisis: 'Pendiente'
                        }))
                    }
                },
                include: {
                    pacientes: true,
                    detalles_solicitud: {
                        include: { tipos_analisis: true }
                    }
                }
            });
        });

        res.status(201).json({
            message: 'Solicitud de análisis registrada correctamente',
            solicitud: nuevaSolicitud
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al crear la solicitud de análisis' });
    }
};

// 3. Listar solicitudes (el médico ve solo las suyas; recepción/lab ven todas)
const listarSolicitudes = async (req, res) => {
    try {
        let filtro = {};

        if (req.user.rol === 'Médico' || req.user.rol === 'Medico') {
            const medico = await prisma.medicos.findUnique({
                where: { usuario_id: req.user.id }
            });
            if (medico) {
                filtro = { medico_id: medico.id };
            }
        }

        const solicitudes = await prisma.solicitudes.findMany({
            where: filtro,
            orderBy: { fecha_solicitud: 'desc' },
            include: {
                pacientes: true,
                medicos: {
                    select: { nombre_completo: true, especialidad: true }
                },
                detalles_solicitud: {
                    include: { tipos_analisis: true }
                }
            }
        });

        res.json(solicitudes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al listar las solicitudes' });
    }
};

module.exports = { listarCatalogo, crearSolicitud, listarSolicitudes };