import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Removendo produtos sem especialista (orphan products)...');

  // Buscar IDs de especialistas válidos
  const specialists = await prisma.user.findMany({ where: { role: 'SPECIALIST' }, select: { id: true } });
  const specialistIds = specialists.map((s) => s.id);

  // Condição para 'orphan': specialist_id is null OR specialist_id not in current specialists
  const orphanCondition: any = {
    OR: [{ specialist_id: null }],
  };
  if (specialistIds.length > 0) {
    orphanCondition.OR.push({ specialist_id: { notIn: specialistIds } });
  }

  // Apaga imagens vinculadas a produtos órfãos
  await prisma.car_image.deleteMany({ where: { car: { OR: [{ specialist_id: null }, ...(specialistIds.length ? [{ specialist_id: { notIn: specialistIds } }] : [])] } } });
  await prisma.boat_image.deleteMany({ where: { boat: { OR: [{ specialist_id: null }, ...(specialistIds.length ? [{ specialist_id: { notIn: specialistIds } }] : [])] } } });
  await prisma.aircraft_image.deleteMany({ where: { aircraft: { OR: [{ specialist_id: null }, ...(specialistIds.length ? [{ specialist_id: { notIn: specialistIds } }] : [])] } } });

  // Apaga os próprios produtos que não têm especialista associado ou cujo specialist_id é inválido
  const deletedCars = await prisma.car.deleteMany({ where: orphanCondition });
  const deletedBoats = await prisma.boat.deleteMany({ where: orphanCondition });
  const deletedAircrafts = await prisma.aircraft.deleteMany({ where: orphanCondition });

  console.log(`✅ Produtos removidos: cars=${deletedCars.count}, boats=${deletedBoats.count}, aircrafts=${deletedAircrafts.count}`);
}

main()
  .catch((e) => {
    console.error('❌ Erro ao remover orphan products:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
