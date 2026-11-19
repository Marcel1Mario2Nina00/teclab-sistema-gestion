const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();


// 1. Listar análisis asignados al Laboratorista autenticado
const listarAnalisisPendientes = async (req, res) => {
    try {
        const laboratorista = await prisma.personal_laboratorio.findUnique({
            where: { usuario_id: req.user.id }
        });

        if (!laboratorista) {
            return res.status(404).json({ message: 'Perfil de laboratorista no encontrado' });
        }

        const pendientes = await prisma.detalles_solicitud.findMany({
            where: {
                laboratorista_id: laboratorista.id,
                estado_analisis: { in: ['Pendiente', 'Procesando'] }
            },
            include: {
                tipos_analisis: {
                    include: { categorias_analisis: true }
                },
                solicitudes: {
                    include: {
                        pacientes: true,
                        medicos: { select: { nombre_completo: true } }
                    }
                }
            }
        });

        res.json(pendientes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al listar los análisis pendientes' });
    }
};

// 2. Registrar resultado clínico + imágenes y actualizar estados automáticamente
const registrarResultado = async (req, res) => {
    try {
        const { detalle_id, informe_texto } = req.body;
        const archivos = req.files || [];

        if (!detalle_id || !informe_texto) {
            return res.status(400).json({
                message: 'El detalle_id y el informe_texto son obligatorios'
            });
        }

        // Buscar el perfil del laboratorista autenticado
        const laboratorista = await prisma.personal_laboratorio.findUnique({
            where: { usuario_id: req.user.id }
        });

        if (!laboratorista) {
            return res.status(404).json({ message: 'Perfil de laboratorista no encontrado' });
        }

        // Verificar que el detalle de solicitud exista
        const detalle = await prisma.detalles_solicitud.findUnique({
            where: { id: parseInt(detalle_id) }
        });

        if (!detalle) {
            return res.status(404).json({ message: 'Detalle de análisis no encontrado' });
        }

        // Transacción atómica: Guardar resultado + imágenes + actualizar detalle + evaluar solicitud
        const resultadoFinal = await prisma.$transaction(async (tx) => {
            // 1. Crear el resultado
            const nuevoResultado = await tx.resultados.create({
                data: {
                    detalle_id: parseInt(detalle_id),
                    informe_texto
                }
            });

            // 2. Guardar las imágenes adjuntas (si las hay)
            if (archivos.length > 0) {
                await tx.imagenes_resultado.createMany({
                    data: archivos.map((file) => ({
                        resultado_id: nuevoResultado.id,
                        ruta_imagen: file.path,
                        descripcion: file.originalname
                    }))
                });
            }

            // 3. Marcar este análisis como Completado y asignar el laboratorista
            await tx.detalles_solicitud.update({
                where: { id: parseInt(detalle_id) },
                data: {
                    estado_analisis: 'Completado',
                    laboratorista_id: laboratorista.id
                }
            });

            // 4. Revisar si quedan análisis pendientes en esta misma solicitud
            const faltantes = await tx.detalles_solicitud.count({
                where: {
                    solicitud_id: detalle.solicitud_id,
                    estado_analisis: { not: 'Completado' }
                }
            });

            // Si no falta ninguno -> Finalizado; si aún faltan -> En_Proceso
            const nuevoEstadoSolicitud = faltantes === 0 ? 'Finalizado' : 'En_Proceso';

            await tx.solicitudes.update({
                where: { id: detalle.solicitud_id },
                data: { estado_general: nuevoEstadoSolicitud }
            });

            return {
                resultado: nuevoResultado,
                imagenes_guardadas: archivos.length,
                estado_solicitud: nuevoEstadoSolicitud
            };
        });

        res.status(201).json({
            message: 'Resultado registrado correctamente',
            ...resultadoFinal
        });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ message: 'Este análisis ya tiene un resultado registrado' });
        }
        console.error(error);
        res.status(500).json({ message: 'Error al registrar el resultado' });
    }
};

// 3. Obtener los resultados completos de una solicitud (para el Médico o Recepcionista)
const obtenerResultadosPorSolicitud = async (req, res) => {
    try {
        const { solicitud_id } = req.params;

        const solicitud = await prisma.solicitudes.findUnique({
            where: { id: parseInt(solicitud_id) },
            include: {
                pacientes: true,
                medicos: {
                    include: { centros_medicos: { select: { nombre: true } } }
                },
                detalles_solicitud: {
                    include: {
                        tipos_analisis: true,
                        personal_laboratorio: { select: { nombre_completo: true } },
                        resultados: {
                            include: { imagenes_resultado: true }
                        }
                    }
                }
            }
        });

        if (!solicitud) {
            return res.status(404).json({ message: 'Solicitud no encontrada' });
        }

        res.json(solicitud);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener los resultados de la solicitud' });
    }
};

module.exports = {
    listarAnalisisPendientes,
    registrarResultado,
    obtenerResultadosPorSolicitud
};