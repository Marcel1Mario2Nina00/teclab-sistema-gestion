const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const reemplazos = {
  'Hemograma Completo': 'Hemoglobina',
  'Grupo Sanguíneo y Factor Rh': 'Grupo Sanguíneo',
  'Glicemia en Ayunas': 'Glucosa',
  'Perfil Lipídico': 'Colesterol',
  'Examen General de Orina (EGO)': 'Físico - Químico',
  'Coproparasitológico': 'Parasitológico',
};

async function limpiarCatalogo() {
  try {
    for (const [viejoNombre, nuevoNombre] of Object.entries(reemplazos)) {
      const viejo = await prisma.tipos_analisis.findFirst({ where: { nombre: viejoNombre } });
      const nuevo = await prisma.tipos_analisis.findFirst({ where: { nombre: nuevoNombre } });

      if (viejo && nuevo) {
        // Reasignar cualquier solicitud existente al análisis oficial
        await prisma.detalles_solicitud.updateMany({
          where: { tipo_analisis_id: viejo.id },
          data: { tipo_analisis_id: nuevo.id },
        });

        // Eliminar el análisis de prueba
        await prisma.tipos_analisis.delete({ where: { id: viejo.id } });
        console.log(`🗑️ Eliminado "${viejoNombre}" (reasignado a "${nuevoNombre}")`);
      }
    }

    const total = await prisma.tipos_analisis.count();
    console.log(`✅ Catálogo limpio. Total de análisis oficiales en BD: ${total}`);
  } catch (error) {
    console.error('❌ Error al limpiar el catálogo:', error);
  } finally {
    await prisma.$disconnect();
  }
}

limpiarCatalogo();