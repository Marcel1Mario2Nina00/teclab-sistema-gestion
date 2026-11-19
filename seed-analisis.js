const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function poblarTiposAnalisis() {
  try {
    const categorias = await prisma.categorias_analisis.findMany();

    if (categorias.length === 0) {
      console.log('No hay categorías en la base de datos.');
      return;
    }

    // Asignamos análisis clínicos reales a tus primeras categorías existentes
    const analisisDePrueba = [
      { categoria_id: categorias[0].id, nombre: 'Hemograma Completo' },
      { categoria_id: categorias[0].id, nombre: 'Grupo Sanguíneo y Factor Rh' },
      { categoria_id: categorias[1]?.id || categorias[0].id, nombre: 'Glicemia en Ayunas' },
      { categoria_id: categorias[1]?.id || categorias[0].id, nombre: 'Perfil Lipídico' },
      { categoria_id: categorias[2]?.id || categorias[0].id, nombre: 'Examen General de Orina (EGO)' },
      { categoria_id: categorias[2]?.id || categorias[0].id, nombre: 'Coproparasitológico' }
    ];

    await prisma.tipos_analisis.createMany({
      data: analisisDePrueba
    });

    console.log('✅ Se insertaron 6 tipos de análisis correctamente.');
  } catch (error) {
    console.error('❌ Error al poblar análisis:', error);
  } finally {
    await prisma.$disconnect();
  }
}

poblarTiposAnalisis();