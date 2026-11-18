const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // 1. Buscar al usuario y su rol
        const user = await prisma.usuarios.findUnique({
            where: { username },
            include: { roles: true }
        });

        if (!user || user.estado !== 'Activo') {
            return res.status(401).json({ message: 'Usuario no encontrado o inactivo' });
        }

        // 2. Verificar contraseña
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Contraseña incorrecta' });
        }

        // 3. Generar Token JWT
        const token = jwt.sign(
            { id: user.id, rol: user.roles.nombre },
            process.env.JWT_SECRET || 'teclab_super_secret_key',
            { expiresIn: '8h' }
        );

        res.json({
            message: 'Login exitoso',
            token,
            user: {
                id: user.id,
                username: user.username,
                rol: user.roles.nombre
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

module.exports = { login };