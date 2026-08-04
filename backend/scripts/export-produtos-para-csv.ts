import { PrismaClient } from '@prisma/client';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const prisma = new PrismaClient();

type ProductWithIdentifierSource = {
  specialist_id: string | null;
  marca: string;
  modelo: string;
};

const csvHeaders = {
  carros: [
    'marca',
    'modelo',
    'identificador',
    'valor',
    'estado',
    'ano',
    'cor',
    'km',
    'cambio',
    'combustivel',
    'tipo_categoria',
    'descricao',
  ],
  barcos: [
    'marca',
    'modelo',
    'identificador',
    'valor',
    'estado',
    'ano',
    'fabricante',
    'tamanho',
    'estilo',
    'combustivel',
    'motor',
    'ano_motor',
    'tipo_embarcacao',
    'descricao_completa',
    'acessorios',
  ],
  aeronaves: [
    'marca',
    'modelo',
    'identificador',
    'valor',
    'estado',
    'ano',
    'categoria',
    'assentos',
    'tipo_aeronave',
    'descricao',
  ],
} as const;

function escapeCsv(value: unknown): string {
  const normalized = value == null ? '' : String(value);

  return /[;"\n\r]/.test(normalized)
    ? `"${normalized.replaceAll('"', '""')}"`
    : normalized;
}

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'SEM-NOME';
}

function generatedIdentifiers<T extends ProductWithIdentifierSource>(records: T[]) {
  const sequences = new Map<string, number>();

  return records.map((record) => {
    const key = [record.specialist_id ?? '', record.marca, record.modelo].join('\u0000');
    const sequence = (sequences.get(key) ?? 0) + 1;
    sequences.set(key, sequence);

    return `${slug(record.marca)}-${slug(record.modelo)}-${sequence}`;
  });
}

function toCsv(headers: readonly string[], rows: unknown[][]): string {
  return [headers, ...rows]
    .map((row) => row.map(escapeCsv).join(';'))
    .join('\n')
    .concat('\n');
}

async function main() {
  const [cars, boats, aircraft] = await Promise.all([
    prisma.car.findMany({
      select: {
        specialist_id: true,
        marca: true,
        modelo: true,
        valor: true,
        estado: true,
        ano: true,
        cor: true,
        km: true,
        cambio: true,
        combustivel: true,
        tipo_categoria: true,
        descricao: true,
      },
      orderBy: { id: 'asc' },
    }),
    prisma.boat.findMany({
      select: {
        specialist_id: true,
        marca: true,
        modelo: true,
        valor: true,
        estado: true,
        ano: true,
        fabricante: true,
        tamanho: true,
        estilo: true,
        combustivel: true,
        motor: true,
        ano_motor: true,
        tipo_embarcacao: true,
        descricao_completa: true,
        acessorios: true,
      },
      orderBy: { id: 'asc' },
    }),
    prisma.aircraft.findMany({
      select: {
        specialist_id: true,
        marca: true,
        modelo: true,
        valor: true,
        estado: true,
        ano: true,
        categoria: true,
        assentos: true,
        tipo_aeronave: true,
        descricao: true,
      },
      orderBy: { id: 'asc' },
    }),
  ]);

  const outputDirectory = resolve(__dirname, 'out');
  await mkdir(outputDirectory, { recursive: true });

  const carIdentifiers = generatedIdentifiers(cars);
  const boatIdentifiers = generatedIdentifiers(boats);
  const aircraftIdentifiers = generatedIdentifiers(aircraft);

  const files = [
    {
      name: 'carros.csv',
      content: toCsv(
        csvHeaders.carros,
        cars.map((car, index) => [
          car.marca,
          car.modelo,
          carIdentifiers[index],
          car.valor,
          car.estado,
          car.ano,
          car.cor,
          car.km,
          car.cambio,
          car.combustivel,
          car.tipo_categoria,
          car.descricao,
        ]),
      ),
    },
    {
      name: 'barcos.csv',
      content: toCsv(
        csvHeaders.barcos,
        boats.map((boat, index) => [
          boat.marca,
          boat.modelo,
          boatIdentifiers[index],
          boat.valor,
          boat.estado,
          boat.ano,
          boat.fabricante,
          boat.tamanho,
          boat.estilo,
          boat.combustivel,
          boat.motor,
          boat.ano_motor,
          boat.tipo_embarcacao,
          boat.descricao_completa,
          boat.acessorios,
        ]),
      ),
    },
    {
      name: 'aeronaves.csv',
      content: toCsv(
        csvHeaders.aeronaves,
        aircraft.map((item, index) => [
          item.marca,
          item.modelo,
          aircraftIdentifiers[index],
          item.valor,
          item.estado,
          item.ano,
          item.categoria,
          item.assentos,
          item.tipo_aeronave,
          item.descricao,
        ]),
      ),
    },
  ];

  await Promise.all(
    files.map(async ({ name, content }) => {
      const outputPath = resolve(outputDirectory, name);
      await writeFile(outputPath, content, 'utf8');
      console.log(`${outputPath}: ${content.split('\n').length - 2} registros exportados`);
    }),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
