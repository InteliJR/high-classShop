import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔎 Contando produtos órfãos (dry-run)...');

  const specialists = await prisma.user.findMany({ where: { role: 'SPECIALIST' }, select: { id: true } });
  const specialistIds = specialists.map((s) => s.id);

  const orphanWhere: any = {
    OR: [{ specialist_id: null }],
  };
  if (specialistIds.length > 0) orphanWhere.OR.push({ specialist_id: { notIn: specialistIds } });

  const carsCount = await prisma.car.count({ where: orphanWhere });
  const boatsCount = await prisma.boat.count({ where: orphanWhere });
  const aircraftCount = await prisma.aircraft.count({ where: orphanWhere });

  console.log(`Cars órfãos: ${carsCount}`);
  console.log(`Boats órfãos: ${boatsCount}`);
  console.log(`Aircrafts órfãos: ${aircraftCount}`);

  // Exibir alguns exemplos (max 5 cada)
  if (carsCount > 0) {
    const sampleCars = await prisma.car.findMany({ where: orphanWhere, take: 5 });
    console.log('Exemplo cars:', sampleCars.map(c => ({ id: c.id, marca: c.marca, modelo: c.modelo, specialist_id: c.specialist_id })));
  }
  if (boatsCount > 0) {
    const sampleBoats = await prisma.boat.findMany({ where: orphanWhere, take: 5 });
    console.log('Exemplo boats:', sampleBoats.map(c => ({ id: c.id, marca: c.marca, modelo: c.modelo, specialist_id: c.specialist_id })));
  }
  if (aircraftCount > 0) {
    const sampleAircraft = await prisma.aircraft.findMany({ where: orphanWhere, take: 5 });
    console.log('Exemplo aircrafts:', sampleAircraft.map(c => ({ id: c.id, marca: c.marca, modelo: c.modelo, specialist_id: c.specialist_id })));
  }

  console.log('🔎 Dry-run concluído.');
}

main()
  .catch((e) => {
    console.error('❌ Erro no dry-run:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
