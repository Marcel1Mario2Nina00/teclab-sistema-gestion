async function probarFlujoMedico() {
  try {
    // 1. Aprobar el centro médico ID 1 (Clínica San Vicente que creamos antes)
    const resAprobar = await fetch('http://localhost:3000/api/centros/1/estado', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'Aprobado' })
    });
    console.log('✅ 1. Centro aprobado:', await resAprobar.json());

    // 2. Registrar un médico en ese centro
    const resMedico = await fetch('http://localhost:3000/api/medicos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        centro_id: 1,
        nombre_completo: 'Dra. Elena Rojas',
        telefono: '77012345',
        especialidad: 'Cardiología',
        username: 'dra.rojas',
        password: 'Password123!'
      })
    });
    console.log('✅ 2. Médico registrado:', await resMedico.json());

    // 3. Probar Login real con la cuenta recién creada
    const resLogin = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'dra.rojas',
        password: 'Password123!'
      })
    });
    console.log('🔐 3. Login del médico (Token JWT):', await resLogin.json());
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

probarFlujoMedico();