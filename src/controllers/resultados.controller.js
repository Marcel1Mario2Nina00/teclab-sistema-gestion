const { PrismaClient } = require('@prisma/client');
const PDFDocument = require('pdfkit');
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

// 4. Generar y descargar el Informe Clínico oficial en PDF
const generarInformePDF = async (req, res) => {
    try {
        const { solicitud_id } = req.params;

        const solicitud = await prisma.solicitudes.findUnique({
            where: { id: parseInt(solicitud_id) },
            include: {
                pacientes: true,
                medicos: {
                    include: { centros_medicos: true }
                },
                detalles_solicitud: {
                    include: {
                        tipos_analisis: {
                            include: { categorias_analisis: true }
                        },
                        personal_laboratorio: true,
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

        // Configurar cabeceras HTTP para descarga/visualización de PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `inline; filename="informe-teclab-solicitud-${solicitud.id}.pdf"`
        );

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        doc.pipe(res);

        // --- ENCABEZADO / MEMBRETE ---
        doc
            .fontSize(20)
            .font('Helvetica-Bold')
            .fillColor('#0B4F6C')
            .text('TECLAB - LABORATORIO DE ANÁLISIS CLÍNICOS', { align: 'center' });

        doc
            .fontSize(10)
            .font('Helvetica')
            .fillColor('#555555')
            .text('Informe Oficial de Resultados Clínicos | Santa Cruz de la Sierra, Bolivia', {
                align: 'center'
            });

        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#0B4F6C').lineWidth(1.5).stroke();
        doc.moveDown(1);

        // --- DATOS DEL PACIENTE Y LA SOLICITUD ---
        doc.fillColor('#000000').fontSize(12).font('Helvetica-Bold').text('DATOS GENERALES');
        doc.moveDown(0.3);

        doc.fontSize(10).font('Helvetica');
        doc.text(`N° de Solicitud: #${solicitud.id}          Estado: ${solicitud.estado_general}`);
        doc.text(`Fecha de Solicitud: ${new Date(solicitud.fecha_solicitud).toLocaleString('es-BO')}`);
        doc.text(`Paciente: ${solicitud.pacientes.nombre_completo}          CI: ${solicitud.pacientes.ci}`);
        doc.text(`Edad: ${solicitud.pacientes.edad ?? 'N/D'} años          Sexo: ${solicitud.pacientes.sexo}`);
        doc.text(`Médico Solicitante: ${solicitud.medicos.nombre_completo} (${solicitud.medicos.especialidad || 'General'})`);
        doc.text(`Centro Médico: ${solicitud.medicos.centros_medicos.nombre}`);

        if (solicitud.observaciones) {
            doc.text(`Observaciones: ${solicitud.observaciones}`);
        }

        doc.moveDown(1);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#CCCCCC').lineWidth(1).stroke();
        doc.moveDown(1);

        // --- RESULTADOS DE ANÁLISIS ---
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#0B4F6C').text('RESULTADOS DE ANÁLISIS CLÍNICOS');
        doc.moveDown(0.5);

        solicitud.detalles_solicitud.forEach((detalle, index) => {
            doc
                .fontSize(11)
                .font('Helvetica-Bold')
                .fillColor('#000000')
                .text(
                    `${index + 1}. ${detalle.tipos_analisis.nombre} (${detalle.tipos_analisis.categorias_analisis.nombre})`
                );

            doc
                .fontSize(9)
                .font('Helvetica-Oblique')
                .fillColor('#555555')
                .text(
                    `Estado: ${detalle.estado_analisis} | Responsable: ${
                        detalle.personal_laboratorio?.nombre_completo || 'Sin asignar'
                    }`
                );

            doc.moveDown(0.2);

            if (detalle.resultados) {
                doc
                    .fontSize(10)
                    .font('Helvetica')
                    .fillColor('#111111')
                    .text(detalle.resultados.informe_texto, { indent: 15 });

                if (detalle.resultados.imagenes_resultado.length > 0) {
                    doc
                        .fontSize(9)
                        .fillColor('#0B4F6C')
                        .text(
                            `Imágenes adjuntas: ${detalle.resultados.imagenes_resultado.length} archivo(s) de respaldo en plataforma.`,
                            { indent: 15 }
                        );
                }
            } else {
                doc
                    .fontSize(10)
                    .font('Helvetica-Oblique')
                    .fillColor('#888888')
                    .text('Resultado pendiente de procesamiento.', { indent: 15 });
            }

            doc.moveDown(0.8);
        });

        // --- PIE DE PÁGINA / FIRMA ---
        doc.moveDown(2);
        doc.moveTo(180, doc.y).lineTo(415, doc.y).strokeColor('#000000').lineWidth(1).stroke();
        doc.moveDown(0.3);
        doc
            .fontSize(9)
            .font('Helvetica')
            .fillColor('#333333')
            .text('Firma y Sello - Dirección Técnica TECLAB', { align: 'center' });
        doc.text(`Documento generado automáticamente el ${new Date().toLocaleString('es-BO')}`, {
            align: 'center'
        });

        doc.end();
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al generar el informe PDF' });
    }
};

module.exports = {
    listarAnalisisPendientes,
    registrarResultado,
    obtenerResultadosPorSolicitud,
    generarInformePDF
};