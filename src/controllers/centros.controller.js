const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const solicitarSuscripcion = async (req, res) => {
    try {
        const { nombre, responsable, direccion, telefono, especialidades } = req.body;
        
        // Verificamos si se subió el archivo
        const rutaCarta = req.file ? req.file.path : null;

        if (!rutaCarta) {
            return res.status(400).json({ message: 'La carta notariada es obligatoria' });
        }

        // Crear el centro médico en estado Pendiente
        const nuevoCentro = await prisma.centros_medicos.create({
            data: {
                nombre,
                responsable,
                direccion,
                telefono,
                especialidades,
                ruta_carta_notariada: rutaCarta,
                estado: 'Pendiente'
            }
        });

        res.status(201).json({
            message: 'Solicitud de suscripción enviada correctamente. En espera de aprobación.',
            centro: nuevoCentro
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al procesar la solicitud de suscripción' });
    }
};

// Obtener todos los centros pendientes
const listarPendientes = async (req, res) => {
    try {
        const centros = await prisma.centros_medicos.findMany({
            where: { estado: 'Pendiente' },
            orderBy: { fecha_registro: 'desc' }
        });
        res.json(centros);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener las solicitudes pendientes' });
    }
};

// Aprobar o rechazar un centro
const cambiarEstado = async (req, res) => {
    try {
        const { id } = req.params;
        const { estado } = req.body; // Se espera 'Aprobado' o 'Rechazado'

        const centroActualizado = await prisma.centros_medicos.update({
            where: { id: parseInt(id) },
            data: { estado }
        });

        res.json({
            message: `El centro médico ha sido marcado como ${estado}`,
            centro: centroActualizado
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al actualizar el estado de la suscripción' });
    }
};
const listarCentros = async (req, res) => {
    try {
        const centros = await prisma.centros_medicos.findMany({
            orderBy: { fecha_registro: 'desc' }
        });
        res.json(centros);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al listar los centros médicos' });
    }
};

module.exports = { solicitarSuscripcion, listarPendientes, cambiarEstado, listarCentros };