const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function probarAsignacion() {
  try {
    // 0. Asegurar que exista el rol y un usuario Recepcionista de prueba
    let rolRecep = await prisma.roles.findFirst({ where: { nombre: 'Recepcionista' } });
    if (!rolRecep) {
      rolRecep = await prisma.roles.create({ data: { nombre: 'Recepcionista' } });
    }

    let userRecep = await prisma.usuarios.findUnique({ where: { username: 'recep.ana' } });
    if (!userRecep) {
      const hash = await bcrypt.hash('Recep123!', 10);
      userRecep = await prisma.usuarios.create({
        data: { username: 'recep.ana', password_hash: hash, rol_id: rolRecep.id, estado: 'Activo' }
      });
      await prisma.personal_laboratorio.create({
        data: { usuario_id: userRecep.id, nombre_completo: 'Lic. Ana Morales', cargo: 'Recepcionista' }
      });
    }

    // 1. Login Médico y crear una nueva solicitud (#2)
    const loginMed = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'dra.rojas', password: 'Password123!' })
    }).then(r => r.json());

    const nuevaSol = await fetch('http://localhost:3000/api/solicitudes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginMed.token}`
      },
      body: JSON.stringify({
        paciente: { ci: '7741258 SC', nombre_completo: 'María Fernanda López', edad: 29, sexo: 'F' },
        forma_obtencion: 'Laboratorio_recoge_muestra',
        observaciones: 'Recoger muestra en Clínica San Vicente a las 8:00 AM',
        tipos_analisis_ids: [1, 3]
      })
    }).then(r => r.json());
    const solicitudId = nuevaSol.solicitud.id;
    console.log(`📝 1. Médico creó la Solicitud #${solicitudId}`);

    // 2. Login Recepcionista, listar laboratoristas y asignar la solicitud
    const loginRecep = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'recep.ana', password: 'Recep123!' })
    }).then(r => r.json());

    const labs = await fetch('http://localhost:3000/api/solicitudes/laboratoristas', {
      headers: { Authorization: `Bearer ${loginRecep.token}` }
    }).then(r => r.json());
    console.log('👩‍🔬 2. Laboratoristas disponibles:', labs);

    const asignacion = await fetch(`http://localhost:3000/api/solicitudes/${solicitudId}/asignar`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginRecep.token}`
      },
      body: JSON.stringify({ laboratorista_id: labs[0].id })
    }).then(r => r.json());
    console.log('✅ 3. Asignación del Recepcionista:', asignacion.message);

    // 3. Login Laboratorista y comprobar que ve sus análisis asignados
    const loginLab = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'lab.carlos', password: 'Lab123!' })
    }).then(r => r.json());

    const bandejaLab = await fetch('http://localhost:3000/api/resultados/pendientes', {
      headers: { Authorization: `Bearer ${loginLab.token}` }
    }).then(r => r.json());
    console.log(`🧪 4. Análisis asignados en la bandeja de ${labs[0].nombre_completo}:`, bandejaLab.length);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

probarAsignacion();