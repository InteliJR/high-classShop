import { PrismaClient } from '@prisma/client';
import { mockCars } from '../src/mocks/car.mock';
import { mockBoats } from '../src/mocks/boat.mock';
import { mockAircrafts } from '../src/mocks/aircrafts.mock';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Clear existing data
  console.log('🧹 Cleaning existing data...');
  await prisma.car_image.deleteMany();
  await prisma.boat_image.deleteMany();
  await prisma.aircraft_image.deleteMany();
  await prisma.car.deleteMany();
  await prisma.boat.deleteMany();
  await prisma.aircraft.deleteMany();

  // Seed Cars
  console.log('🚗 Seeding cars...');
  for (const carMock of mockCars) {
    const car = await prisma.car.create({
      data: {
        marca: carMock.marca,
        modelo: carMock.modelo,
        valor: carMock.valor,
        estado: carMock.estado,
        ano: carMock.ano,
        descricao: carMock.descricao,
        cor: carMock.cor,
        km: carMock.km,
        cambio: carMock.cambio,
        combustivel: carMock.combustivel,
        tipo_categoria: carMock.tipo_categoria,
      },
    });

    // Create images for this car
    for (const image of carMock.images) {
      await prisma.car_image.create({
        data: {
          product_type: 'CAR',
          image_url: image.url,
          is_primary: image.is_primary,
          car_id: car.id,
        },
      });
    }
    console.log(`  ✅ Created car: ${car.marca} ${car.modelo}`);
  }

  // Seed Boats
  console.log('⛵ Seeding boats...');
  for (const boatMock of mockBoats) {
    const boat = await prisma.boat.create({
      data: {
        marca: boatMock.marca,
        modelo: boatMock.modelo,
        valor: boatMock.valor,
        ano: boatMock.ano,
        fabricante: boatMock.fabricante,
        tamanho: boatMock.tamanho,
        estilo: boatMock.estilo,
        combustivel: boatMock.combustivel,
        motor: boatMock.motor,
        ano_motor: boatMock.ano_motor,
        descricao_completa: boatMock.descricao_completa,
        acessorios: boatMock.acessorios,
        estado: boatMock.estado,
        tipo_embarcacao: boatMock.tipo_embarcacao,
      },
    });

    // Create images for this boat
    for (const image of boatMock.images) {
      await prisma.boat_image.create({
        data: {
          product_type: 'BOAT',
          image_url: image.url,
          is_primary: image.is_primary,
          boat_id: boat.id,
        },
      });
    }
    console.log(`  ✅ Created boat: ${boat.marca} ${boat.modelo}`);
  }

  // Seed Aircrafts
  console.log('✈️  Seeding aircrafts...');
  for (const aircraftMock of mockAircrafts) {
    const aircraft = await prisma.aircraft.create({
      data: {
        categoria: aircraftMock.categoria,
        ano: aircraftMock.ano,
        marca: aircraftMock.marca,
        modelo: aircraftMock.modelo,
        assentos: aircraftMock.assentos,
        estado: aircraftMock.estado,
        descricao: aircraftMock.descricao,
        valor: aircraftMock.valor,
        tipo_aeronave: aircraftMock.tipo_aeronave,
      },
    });

    // Create images for this aircraft
    for (const image of aircraftMock.images) {
      await prisma.aircraft_image.create({
        data: {
          product_type: 'AIRCRAFT',
          image_url: image.url,
          is_primary: image.is_primary,
          aircraft_id: aircraft.id,
        },
      });
    }
    console.log(`  ✅ Created aircraft: ${aircraft.marca} ${aircraft.modelo}`);
  }

  console.log('');
  console.log('📊 Seed summary:');
  const carsCount = await prisma.car.count();
  const boatsCount = await prisma.boat.count();
  const aircraftsCount = await prisma.aircraft.count();
  const carImagesCount = await prisma.car_image.count();
  const boatImagesCount = await prisma.boat_image.count();
  const aircraftImagesCount = await prisma.aircraft_image.count();

  console.log(`  🚗 Cars: ${carsCount} (${carImagesCount} images)`);
  console.log(`  ⛵ Boats: ${boatsCount} (${boatImagesCount} images)`);
  console.log(`  ✈️  Aircrafts: ${aircraftsCount} (${aircraftImagesCount} images)`);
  console.log('');
  console.log('✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
