import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Limpando processos relacionados a produtos...');

  // Remove processos que referenciam produtos
  await prisma.processStatusHistory.deleteMany({});
  await prisma.process.deleteMany({});

  console.log('🧹 Limpando imagens de produtos...');

  await prisma.car_image.deleteMany({});
  await prisma.boat_image.deleteMany({});
  await prisma.aircraft_image.deleteMany({});

  console.log('🧹 Limpando produtos (carros, lanchas, aeronaves)...');

  await prisma.car.deleteMany({});
  await prisma.boat.deleteMany({});
  await prisma.aircraft.deleteMany({});

  console.log('✅ Limpeza de produtos concluída com sucesso.');
}

main()
  .catch((e) => {
    console.error('❌ Erro ao limpar produtos:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


