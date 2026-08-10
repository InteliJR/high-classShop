import { CarsService } from './cars/cars.service';
import { BoatsService } from './boats/boats.service';
import { AircraftsService } from './aircrafts/aircrafts.service';
import {
  AIRCRAFT_COLUMNS,
  BOAT_COLUMNS,
  CAR_COLUMNS,
} from 'src/shared/constants/product-columns';
import { XlsxImportService } from 'src/shared/services/xlsx-import.service';

// getCsvTemplate só lê `xlsxColumns`, então as deps podem ser nulas aqui.
const cases = [
  [
    'carros',
    new CarsService(null as any, null as any, null as any),
    CAR_COLUMNS,
  ],
  [
    'barcos',
    new BoatsService(null as any, null as any, null as any),
    BOAT_COLUMNS,
  ],
  [
    'aeronaves',
    new AircraftsService(null as any, null as any, null as any),
    AIRCRAFT_COLUMNS,
  ],
] as const;

describe('template de importação de produtos', () => {
  const xlsx = new XlsxImportService();

  it.each(cases)(
    'template de %s casa com a fonte única de colunas',
    async (_label, service, columns) => {
      const csv = (await service.getCsvTemplate()).toString('utf-8');
      const [headerLine, exampleLine] = csv
        .replace(/^\uFEFF/, '')
        .trim()
        .split('\n');
      const headers = headerLine.split(';');

      // o header vem da mesma lista que o import valida — se divergir, o
      // usuário baixa um template que o próprio import rejeita
      expect(headers).toEqual(columns.map((column) => column.name));
      expect(headers[0]).toBe('identificador');

      // a linha de exemplo é posicional: casa cada valor com sua coluna para
      // pegar desalinhamento, não só o primeiro campo
      const values = exampleLine.split(';');
      expect(values).toHaveLength(headers.length);
      const example = Object.fromEntries(
        headers.map((header, index) => [header, values[index]]),
      );
      expect(example.identificador).toMatch(/-1$/);
      for (const column of columns.filter((c) => c.type === 'number')) {
        expect(example[column.name]).toMatch(/^\d+$/);
      }
    },
  );

  it.each(cases)(
    'o template de %s é aceito pelo próprio parser de import',
    async (_label, service, columns) => {
      const buffer = await service.getCsvTemplate();
      const { rows } = xlsx.parseCsv(buffer);

      expect(xlsx.validateStructure(rows, columns as any)).toMatchObject({
        valid: true,
        missingRequired: [],
        unknownColumns: [],
      });
    },
  );

  it('planilha na ordem antiga (identificador em 3º) continua válida', () => {
    const legacy = [
      'marca;modelo;identificador;valor;estado;ano',
      'BMW;X5;BMW-X5-1;450000;São Paulo;2023',
    ].join('\n');
    const { rows } = xlsx.parseCsv(Buffer.from(legacy, 'utf-8'));

    expect(rows[0]).toMatchObject({ marca: 'BMW', identificador: 'BMW-X5-1' });
    expect(xlsx.validateStructure(rows, CAR_COLUMNS).missingRequired).toEqual(
      [],
    );
  });
});
