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

// 4. Listar laboratoristas disponibles (para que el Recepcionista elija a quién asignar)
const listarLaboratoristas = async (req, res) => {
    try {
        const laboratoristas = await prisma.personal_laboratorio.findMany({
            where: { cargo: 'Laboratorista' },
            select: {
                id: true,
                nombre_completo: true,
                cargo: true
            }
        });
        res.json(laboratoristas);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al listar laboratoristas' });
    }
};

// 5. Asignar una solicitud y sus análisis a un Laboratorista (solo Recepcionista)
const asignarLaboratorista = async (req, res) => {
    try {
        const { id } = req.params; // ID de la solicitud
        const { laboratorista_id } = req.body;

        if (!laboratorista_id) {
            return res.status(400).json({ message: 'Debe indicar el laboratorista_id' });
        }

        // Buscar el perfil del recepcionista autenticado
        const recepcionista = await prisma.personal_laboratorio.findUnique({
            where: { usuario_id: req.user.id }
        });

        if (!recepcionista) {
            return res.status(404).json({ message: 'Perfil de recepcionista no encontrado' });
        }

        // Verificar que el laboratorista exista
        const laboratorista = await prisma.personal_laboratorio.findUnique({
            where: { id: parseInt(laboratorista_id) }
        });

        if (!laboratorista || laboratorista.cargo !== 'Laboratorista') {
            return res.status(404).json({ message: 'Laboratorista no válido' });
        }

        // Transacción: registrar recepcionista en la solicitud y asignar laboratorista a los análisis
        const solicitudActualizada = await prisma.$transaction(async (tx) => {
            await tx.detalles_solicitud.updateMany({
                where: { solicitud_id: parseInt(id) },
                data: {
                    laboratorista_id: parseInt(laboratorista_id),
                    estado_analisis: 'Procesando'
                }
            });

            return await tx.solicitudes.update({
                where: { id: parseInt(id) },
                data: {
                    recepcionista_id: recepcionista.id,
                    estado_general: 'En_Proceso'
                },
                include: {
                    pacientes: true,
                    detalles_solicitud: {
                        include: {
                            tipos_analisis: true,
                            personal_laboratorio: { select: { id: true, nombre_completo: true } }
                        }
                    }
                }
            });
        });

        res.json({
            message: `Solicitud #${id} asignada correctamente a ${laboratorista.nombre_completo}`,
            solicitud: solicitudActualizada
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al asignar la solicitud' });
    }
};

module.exports = {
    listarCatalogo,
    crearSolicitud,
    listarSolicitudes,
    listarLaboratoristas,
    asignarLaboratorista
};