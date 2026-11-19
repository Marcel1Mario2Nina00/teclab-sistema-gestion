const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function probarResultados() {
  try {
    // 0. Asegurar que exista el rol y un usuario Laboratorista de prueba
    let rolLab = await prisma.roles.findFirst({ where: { nombre: 'Laboratorista' } });
    if (!rolLab) {
      rolLab = await prisma.roles.create({ data: { nombre: 'Laboratorista' } });
    }

    let userLab = await prisma.usuarios.findUnique({ where: { username: 'lab.carlos' } });
    if (!userLab) {
      const hash = await bcrypt.hash('Lab123!', 10);
      userLab = await prisma.usuarios.create({
        data: { username: 'lab.carlos', password_hash: hash, rol_id: rolLab.id, estado: 'Activo' }
      });
      await prisma.personal_laboratorio.create({
        data: { usuario_id: userLab.id, nombre_completo: 'Lic. Carlos Vargas', cargo: 'Laboratorista' }
      });
    }

    // 1. Login como Laboratorista
    const resLogin = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'lab.carlos', password: 'Lab123!' })
    });
    const { token } = await resLogin.json();
    console.log('🔐 1. Login Laboratorista OK');

    // 2. Listar análisis pendientes
    const resPend = await fetch('http://localhost:3000/api/resultados/pendientes', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const pendientes = await resPend.json();
    console.log('🧪 2. Análisis pendientes encontrados:', pendientes.length);

    if (pendientes.length === 0) {
      console.log('⚠️ No hay análisis pendientes para procesar.');
      return;
    }

    // 3. Procesar cada análisis pendiente (subiendo una imagen simulada en cada uno)
    for (const item of pendientes) {
      const formData = new FormData();
      formData.append('detalle_id', item.id.toString());
      formData.append(
        'informe_texto',
        `Resultado de ${item.tipos_analisis.nombre}: Valores dentro del rango normal de referencia.`
      );

      const imgSimulada = new Blob(['imagen-microscopia-simulada'], { type: 'image/png' });
      formData.append('imagenes', imgSimulada, `microscopia-${item.id}.png`);

      const resReg = await fetch('http://localhost:3000/api/resultados', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const dataReg = await resReg.json();
      console.log(`✅ 3. Análisis #${item.id} procesado -> Estado de solicitud:`, dataReg.estado_solicitud);
    }

    // 4. Consultar la solicitud completa con resultados e imágenes
    const solicitudId = pendientes[0].solicitud_id;
    const resFinal = await fetch(`http://localhost:3000/api/resultados/solicitud/${solicitudId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const dataFinal = await resFinal.json();
    console.log('📄 4. Estado final de la solicitud #' + solicitudId + ':', dataFinal.estado_general);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

probarResultados();