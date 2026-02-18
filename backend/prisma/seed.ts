import { PrismaClient } from '@prisma/client';
import { mockCars } from '../src/mocks/car.mock';
import { mockBoats } from '../src/mocks/boat.mock';
import { mockAircrafts } from '../src/mocks/aircrafts.mock';
import {
  mockUsers,
  mockCompanies,
  GENIUS_COMPANY_REF,
} from '../src/mocks/user.mock';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // === STEP 0: Seed PlatformCompany (singleton) ===
  console.log('🏢 Seeding platform company...');
  await prisma.platformCompany.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'BMF LUX BROKERAGE',
      cnpj: '00000000000100',
      bank: 'Banco do Brasil',
      agency: '0001',
      checking_account: '12345-6',
      address: 'Av. Paulista, 1000 - São Paulo/SP',
      cep: '01310-100',
      default_commission_rate: 10.0,
    },
  });
  console.log('  ✅ Platform company seeded');

  // Clear existing data
  console.log('🧹 Cleaning existing data...');
  await prisma.car_image.deleteMany();
  await prisma.boat_image.deleteMany();
  await prisma.aircraft_image.deleteMany();
  await prisma.car.deleteMany();
  await prisma.boat.deleteMany();
  await prisma.aircraft.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  // === STEP 1: Create Companies ===
  console.log('🏢 Seeding companies...');
  const createdCompanies = new Map<string, string>(); // company name -> id mapping

  for (const companyMock of mockCompanies) {
    const company = await prisma.company.create({
      data: {
        name: companyMock.name,
        cnpj: companyMock.cnpj,
        logo: companyMock.logo ?? null,
        description: companyMock.description ?? null,
        commission_rate: companyMock.commission_rate ?? null,
      },
    });

    createdCompanies.set(companyMock.name, company.id);
    console.log(
      `  ✅ Created company: ${company.name} (Rate: ${companyMock.commission_rate}%)`,
    );
  }

  // === STEP 2: Create Users ===
  console.log('👥 Seeding users...');
  const createdUsers = new Map<string, string>(); // email -> id mapping
  const geniusCompanyId = createdCompanies.get('Genius Assessoria Automotiva');

  for (const userMock of mockUsers) {
    // Replace mock company reference with real UUID if applicable
    let company_id = userMock.company_id ?? null;
    if (company_id === GENIUS_COMPANY_REF) {
      company_id = geniusCompanyId ?? null;
    }

    const user = await prisma.user.create({
      data: {
        name: userMock.name,
        surname: userMock.surname,
        email: userMock.email,
        cpf: userMock.cpf,
        rg: userMock.rg,
        role: userMock.role,
        password_hash: userMock.password_hash,

        civil_state: userMock.civil_state ?? null,
        speciality: userMock.speciality ?? null,
        identification_number: userMock.identification_number ?? null,
        commission_rate: userMock.commission_rate ?? null,

        address_id: userMock.address_id ?? null,
        consultant_id: userMock.consultant_id ?? null,
        company_id: company_id,
      },
    });

    createdUsers.set(user.email, user.id);
    const companyInfo = company_id ? ` (Company: ${company_id})` : '';
    console.log(
      `  ➡️  Created user: ${user.email} (ID: ${user.id})${companyInfo}`,
    );
  }

  // Get specialist IDs
  const carSpecialistId = createdUsers.get('carlos.car@example.com');
  const boatSpecialistId = createdUsers.get('marina.boat@example.com');
  const aircraftSpecialistId = createdUsers.get('pedro.aircraft@example.com');

  // === STEP 3: Seed Cars ===
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
        specialist_id: carSpecialistId, // Associate with car specialist
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

  // === STEP 4: Seed Boats ===
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
        specialist_id: boatSpecialistId, // Associate with boat specialist
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

  // === STEP 5: Seed Aircrafts ===
  console.log('✈️  Seeding aircrafts...');
  for (const aircraftMock of mockAircrafts) {
    const aircraft = await prisma.aircraft.create({
      data: {
        ano: aircraftMock.ano,
        marca: aircraftMock.marca,
        modelo: aircraftMock.modelo,
        assentos: aircraftMock.capacidade_passageiros,
        estado: aircraftMock.estado,
        descricao: aircraftMock.descricao,
        valor: aircraftMock.valor,
        tipo_aeronave: aircraftMock.tipo_aeronave,
        categoria: null, // Optional field
        specialist_id: aircraftSpecialistId, // Associate with aircraft specialist
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
  console.log(
    `  ✈️  Aircrafts: ${aircraftsCount} (${aircraftImagesCount} images)`,
  );
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
