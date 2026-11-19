async function probarSolicitud() {
  try {
    // 1. Iniciar sesión como la Dra. Elena Rojas para obtener el Token JWT
    const resLogin = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'dra.rojas',
        password: 'Password123!'
      })
    });
    const loginData = await resLogin.json();
    const token = loginData.token;
    console.log('🔐 1. Token JWT obtenido correctamente');

    // 2. Consultar el catálogo de análisis usando el Token
    const resCatalogo = await fetch('http://localhost:3000/api/solicitudes/catalogo', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const catalogo = await resCatalogo.json();
    console.log('📚 2. Categorías encontradas en catálogo:', catalogo.length);

    // Extraemos los primeros IDs de análisis disponibles en tu BD
    const idsDisponibles = catalogo
      .flatMap(cat => cat.tipos_analisis.map(t => t.id))
      .slice(0, 2);

    if (idsDisponibles.length === 0) {
      console.log('⚠️ Tu tabla tipos_analisis está vacía. Inserta al menos un análisis en MySQL primero.');
      return;
    }

    // 3. Crear una solicitud (creará al paciente automáticamente)
    const resSolicitud = await fetch('http://localhost:3000/api/solicitudes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        paciente: {
          ci: '8945123 SC',
          nombre_completo: 'Juan Pérez Morales',
          edad: 34,
          sexo: 'M'
        },
        forma_obtencion: 'Paciente_trae_muestra',
        observaciones: 'Paciente en ayunas de 12 horas',
        tipos_analisis_ids: idsDisponibles
      })
    });
    console.log('✅ 3. Solicitud creada:', JSON.stringify(await resSolicitud.json(), null, 2));

    // 4. Listar las solicitudes del médico
    const resLista = await fetch('http://localhost:3000/api/solicitudes', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const lista = await resLista.json();
    console.log('📋 4. Total de solicitudes de este médico:', lista.length);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

probarSolicitud();