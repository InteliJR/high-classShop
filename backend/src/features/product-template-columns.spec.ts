import * as ExcelJS from 'exceljs';
import {
  AIRCRAFT_COLUMNS,
  BOAT_COLUMNS,
  CAR_COLUMNS,
} from 'src/shared/constants/product-columns';
import { XlsxImportService } from 'src/shared/services/xlsx-import.service';

const cases = [
  ['carros', CAR_COLUMNS],
  ['barcos', BOAT_COLUMNS],
  ['aeronaves', AIRCRAFT_COLUMNS],
] as const;

async function loadTemplate(xlsx: XlsxImportService, columns: typeof CAR_COLUMNS) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await xlsx.generateTemplate(columns)) as any);
  return workbook;
}

function rowValues(sheet: ExcelJS.Worksheet, rowNumber: number): string[] {
  const values: string[] = [];
  sheet.getRow(rowNumber).eachCell((cell) => values.push(cell.text));
  return values;
}

describe('template de importação de produtos', () => {
  const xlsx = new XlsxImportService();

  it.each(cases)(
    'template de %s casa com a fonte única de colunas',
    async (_label, columns) => {
      const workbook = await loadTemplate(xlsx, columns);
      const data = workbook.worksheets[0];

      // o header vem da mesma lista que o import valida — se divergir, o
      // usuário baixa um template que o próprio import rejeita
      expect(rowValues(data, 1)).toEqual(columns.map((column) => column.name));
      // sem linha de exemplo na aba de dados: ela seria importada por engano
      expect(data.rowCount).toBe(1);
    },
  );

  it.each(cases)(
    'aba Instruções de %s explica cada coluna e só exige valor e moeda',
    async (_label, columns) => {
      const instructions = (await loadTemplate(xlsx, columns)).getWorksheet(
        'Instruções',
      )!;

      const documented = columns.map((_, index) => rowValues(instructions, index + 2));
      expect(documented.map(([name]) => name)).toEqual(
        columns.map((column) => column.name),
      );
      for (const [, , , example, description] of documented) {
        expect(example).toBeTruthy();
        expect(description).toBeTruthy();
      }
      expect(
        documented.filter(([, required]) => required === 'Sim').map(([name]) => name),
      ).toEqual(['valor', 'currency']);
    },
  );

  it.each(cases)(
    'o template de %s preenchido só com valor e moeda é aceito pelo parser',
    async (_label, columns) => {
      const workbook = await loadTemplate(xlsx, columns);
      const data = workbook.worksheets[0];
      const row = data.getRow(2);
      row.getCell(columns.findIndex((c) => c.name === 'valor') + 1).value = 450000;
      row.getCell(columns.findIndex((c) => c.name === 'currency') + 1).value = 'USD';
      const filled = Buffer.from(await workbook.xlsx.writeBuffer());

      const { rows } = await xlsx.parseWorkbook(filled);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ valor: '450000', currency: 'USD' });
      expect(xlsx.validateStructure(rows, columns as any)).toMatchObject({
        valid: true,
        missingRequired: [],
        unknownColumns: [],
      });
    },
  );

  it('link do Drive vindo como hyperlink do Excel é lido como texto', async () => {
    const workbook = await loadTemplate(xlsx, CAR_COLUMNS);
    const data = workbook.worksheets[0];
    const url = 'https://drive.google.com/drive/folders/abc';
    data.getRow(2).getCell(CAR_COLUMNS.length).value = { text: url, hyperlink: url };
    data.getRow(2).getCell(4).value = 1;

    const { rows } = await xlsx.parseWorkbook(
      Buffer.from(await workbook.xlsx.writeBuffer()),
    );

    expect(rows[0].folder_url).toBe(url);
  });

  it('CSV em outra ordem de colunas continua válido', () => {
    const csv = [
      'marca;modelo;identificador;valor;currency;estado;ano',
      'BMW;X5;BMW-X5-1;450000;BRL;São Paulo;2023',
    ].join('\n');
    const { rows } = xlsx.parseCsv(Buffer.from(csv, 'utf-8'));

    expect(rows[0]).toMatchObject({ marca: 'BMW', identificador: 'BMW-X5-1' });
    expect(xlsx.validateStructure(rows, CAR_COLUMNS).missingRequired).toEqual(
      [],
    );
  });

  it('CSV sem a coluna de moeda é rejeitado', () => {
    const { rows } = xlsx.parseCsv(Buffer.from('valor\n450000', 'utf-8'));

    expect(xlsx.validateStructure(rows, CAR_COLUMNS).missingRequired).toEqual([
      'currency',
    ]);
  });
});
