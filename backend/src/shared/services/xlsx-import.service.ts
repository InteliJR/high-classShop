import { Injectable, BadRequestException } from '@nestjs/common';
import { validate, ValidationError } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  ImportResponseDto,
  ImportErrorRow,
  ImportParsedRow,
  ImportStructureValidation,
} from '../dto/import-response.dto';
import * as ExcelJS from 'exceljs';

/**
 * Definição de colunas para validação de estrutura do XLSX
 */
export interface XlsxColumnDefinition {
  name: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean';
}

/**
 * Imagem embutida extraída de um arquivo XLSX
 */
export interface EmbeddedImage {
  buffer: Buffer;
  extension: string;
}

/**
 * Resultado da leitura de uma planilha XLSX
 */
export interface XlsxParseResult {
  rows: ImportParsedRow[];
  imageMap: Map<number, EmbeddedImage[]>;
}

export interface CsvParseResult {
  rows: ImportParsedRow[];
}

@Injectable()
export class XlsxImportService {
  /**
   * Parseia um arquivo XLSX e extrai dados + imagens embutidas.
   * @param fileBuffer Buffer do arquivo XLSX
   * @returns Linhas parseadas + mapa de imagens por índice de linha (0-based, dados)
   */
  async parseWorkbook(fileBuffer: Buffer): Promise<XlsxParseResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as any);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new BadRequestException(
        'A planilha não contém nenhuma aba de dados.',
      );
    }

    // 1. Extrair headers da primeira linha
    const headerRow = worksheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value || '')
        .trim()
        .toLowerCase();
    });

    if (headers.length === 0 || headers.every((h) => !h)) {
      throw new BadRequestException(
        'A planilha deve conter um cabeçalho na primeira linha.',
      );
    }

    // 2. Extrair dados (linha 2 em diante)
    const rows: ImportParsedRow[] = [];
    const rowCount = worksheet.rowCount;

    for (let rowNum = 2; rowNum <= rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);
      const parsedRow: ImportParsedRow = {};
      let hasData = false;

      headers.forEach((header, colIndex) => {
        if (!header) return;
        const cell = row.getCell(colIndex + 1);
        const value = cell.value;

        if (value !== null && value !== undefined && value !== '') {
          hasData = true;
          // ExcelJS pode retornar números diretamente — converter para string pois ImportParsedRow usa Record<string, string>
          parsedRow[header] = String(value);
        } else {
          parsedRow[header] = '';
        }
      });

      if (hasData) {
        rows.push(parsedRow);
      }
    }

    if (rows.length === 0) {
      throw new BadRequestException(
        'A planilha deve conter pelo menos uma linha de dados além do cabeçalho.',
      );
    }

    // 3. Extrair imagens embutidas e mapear por linha
    const imageMap = new Map<number, EmbeddedImage[]>();
    const images = worksheet.getImages();

    for (const img of images) {
      // img.range.tl.nativeRow é 0-based (row 0 = header, row 1 = primeira linha de dados)
      const dataRowIndex = img.range.tl.nativeRow - 1; // -1 para converter em index baseado em dados (0 = primeira linha de dados)

      if (dataRowIndex < 0) continue; // Imagem no header, ignorar

      // Buscar buffer da imagem no modelo do workbook
      const media = (workbook.model as any).media?.find(
        (m: any) => m.index === img.imageId || m.name === `image${img.imageId}`,
      );

      // Fallback: buscar pelo imageId no array de media
      let imageBuffer: Buffer | undefined;
      let extension = 'png';

      if (media) {
        imageBuffer = media.buffer;
        extension = media.extension || media.type || 'png';
      } else {
        // Tentar acessar diretamente via getImage
        const mediaArr = (workbook.model as any).media;
        if (mediaArr && Array.isArray(mediaArr)) {
          const mediaItem = mediaArr[Number(img.imageId)];
          if (mediaItem) {
            imageBuffer = mediaItem.buffer;
            extension = mediaItem.extension || mediaItem.type || 'png';
          }
        }
      }

      if (!imageBuffer) continue;

      if (!imageMap.has(dataRowIndex)) {
        imageMap.set(dataRowIndex, []);
      }

      imageMap.get(dataRowIndex)!.push({
        buffer: Buffer.from(imageBuffer),
        extension: extension.replace('.', ''),
      });
    }

    return { rows, imageMap };
  }

  /**
   * Parseia um arquivo CSV e extrai apenas dados tabulares.
   * Aceita delimitadores "," e ";" com suporte a valores entre aspas.
   */
  parseCsv(fileBuffer: Buffer): CsvParseResult {
    const rawText = fileBuffer.toString('utf-8').replace(/^\uFEFF/, '');
    const lines = rawText
      .split(/\r\n|\n|\r/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) {
      throw new BadRequestException(
        'O CSV deve conter cabeçalho e pelo menos uma linha de dados.',
      );
    }

    const delimiter = this.detectCsvDelimiter(lines[0]);
    const rawHeaders = this.splitCsvLine(lines[0], delimiter);
    const headers = rawHeaders.map((header) => header.trim().toLowerCase());

    if (headers.length === 0 || headers.every((header) => !header)) {
      throw new BadRequestException(
        'O CSV deve conter um cabeçalho válido na primeira linha.',
      );
    }

    const rows: ImportParsedRow[] = [];

    for (let lineIndex = 1; lineIndex < lines.length; lineIndex++) {
      const columns = this.splitCsvLine(lines[lineIndex], delimiter);
      const parsedRow: ImportParsedRow = {};
      let hasData = false;

      headers.forEach((header, columnIndex) => {
        if (!header) return;
        const rawValue = columns[columnIndex] ?? '';
        const value = rawValue.trim();
        parsedRow[header] = value;
        if (value !== '') {
          hasData = true;
        }
      });

      if (hasData) {
        rows.push(parsedRow);
      }
    }

    if (rows.length === 0) {
      throw new BadRequestException(
        'O CSV deve conter pelo menos uma linha de dados além do cabeçalho.',
      );
    }

    return { rows };
  }

  /**
   * Valida a estrutura de uma planilha XLSX (colunas obrigatórias e reconhecidas)
   * Trabalha com as linhas já parseadas.
   */
  validateStructure(
    rows: ImportParsedRow[],
    columnDefinitions: XlsxColumnDefinition[],
  ): ImportStructureValidation {
    if (rows.length === 0) {
      return {
        valid: false,
        errors: ['Planilha está vazia.'],
        foundColumns: [],
        missingRequired: [],
        unknownColumns: [],
      };
    }

    // Pegar colunas a partir das keys da primeira row
    const foundColumns = Object.keys(rows[0]).filter((k) => k !== '');

    const requiredColumns = columnDefinitions
      .filter((c) => c.required)
      .map((c) => c.name.toLowerCase());

    const knownColumns = columnDefinitions.map((c) => c.name.toLowerCase());

    const missingRequired = requiredColumns.filter(
      (col) => !foundColumns.includes(col),
    );

    const unknownColumns = foundColumns.filter(
      (col) => !knownColumns.includes(col) && col !== '',
    );

    const errors: string[] = [];

    if (missingRequired.length > 0) {
      errors.push(
        `Colunas obrigatórias faltando: ${missingRequired.join(', ')}`,
      );
    }

    if (unknownColumns.length > 0) {
      errors.push(`Colunas não reconhecidas: ${unknownColumns.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      foundColumns,
      missingRequired,
      unknownColumns,
    };
  }

  /**
   * Valida uma linha parseada usando class-validator
   */
  async validateRow<T extends object>(
    row: ImportParsedRow,
    DtoClass: new () => T,
    rowNumber: number,
  ): Promise<{ valid: boolean; errors: string[]; instance?: T }> {
    const converted = this.convertTypes(row);

    const instance = plainToInstance(DtoClass, converted, {
      enableImplicitConversion: true,
    });

    const validationErrors = await validate(instance, {
      whitelist: true,
      forbidNonWhitelisted: false,
    });

    if (validationErrors.length > 0) {
      const errors = this.formatValidationErrors(validationErrors);
      return { valid: false, errors };
    }

    return { valid: true, errors: [], instance };
  }

  /**
   * Converte strings para tipos apropriados
   */
  private convertTypes(row: ImportParsedRow): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(row)) {
      if (value === '' || value === undefined || value === null) {
        continue;
      }

      const strValue = String(value);
      const numValue = Number(strValue);
      if (!isNaN(numValue) && strValue.trim() !== '') {
        if (/^-?\d+\.?\d*$/.test(strValue.trim())) {
          result[key] = numValue;
          continue;
        }
      }

      if (
        strValue.toLowerCase() === 'true' ||
        strValue.toLowerCase() === 'false'
      ) {
        result[key] = strValue.toLowerCase() === 'true';
        continue;
      }

      result[key] = strValue;
    }

    return result;
  }

  private detectCsvDelimiter(headerLine: string): ',' | ';' {
    const semicolonCount = (headerLine.match(/;/g) || []).length;
    const commaCount = (headerLine.match(/,/g) || []).length;
    return semicolonCount > commaCount ? ';' : ',';
  }

  private splitCsvLine(line: string, delimiter: ',' | ';'): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
          continue;
        }

        inQuotes = !inQuotes;
        continue;
      }

      if (char === delimiter && !inQuotes) {
        values.push(current);
        current = '';
        continue;
      }

      current += char;
    }

    values.push(current);
    return values;
  }

  /**
   * Formata erros de validação para mensagens legíveis
   */
  private formatValidationErrors(errors: ValidationError[]): string[] {
    const messages: string[] = [];

    for (const error of errors) {
      if (error.constraints) {
        const constraints = Object.values(error.constraints);
        messages.push(`Campo '${error.property}': ${constraints.join(', ')}`);
      }
      if (error.children && error.children.length > 0) {
        messages.push(...this.formatValidationErrors(error.children));
      }
    }

    return messages;
  }

  /**
   * Cria resposta de importação
   */
  createResponse(
    insertedIds: number[],
    errorRows: ImportErrorRow[],
    warningRows: ImportErrorRow[] = [],
    updatedIds: number[] = [],
  ): ImportResponseDto {
    const insertedCount = insertedIds.length;
    const updatedCount = updatedIds.length;
    const errorCount = errorRows.length;
    const warningCount = warningRows.length;

    let message: string;
    let success: boolean;

    const parts: string[] = [];
    if (insertedCount > 0) parts.push(`${insertedCount} inserido(s)`);
    if (updatedCount > 0) parts.push(`${updatedCount} atualizado(s)`);
    if (warningCount > 0) parts.push(`${warningCount} com avisos de imagem`);

    if (errorCount === 0) {
      message = `Importação concluída com sucesso. ${parts.join(', ')}.`;
      success = true;
    } else if (insertedCount === 0 && updatedCount === 0) {
      message = `Importação falhou. Nenhum produto foi inserido ou atualizado. ${errorCount} erro(s) encontrado(s).`;
      success = false;
    } else {
      message = `Importação parcial. ${parts.join(', ')}. ${errorCount} erro(s).`;
      success = true;
    }

    return {
      success,
      message,
      insertedCount,
      updatedCount,
      deactivatedCount: 0,
      deactivatedIds: [],
      reactivatedCount: 0,
      errorCount,
      warningCount,
      errorRows,
      warningRows,
      insertedIds,
      updatedIds,
    };
  }

  /**
   * Gera um workbook XLSX template para download.
   * @param columnDefinitions Definições de colunas
   * @param exampleData Dados de exemplo para a segunda linha
   * @param instructions Instruções por coluna (para comentários nas células do header)
   * @returns Buffer do arquivo XLSX
   */
  async generateTemplate(
    columnDefinitions: XlsxColumnDefinition[],
    exampleData: Record<string, any>,
    instructions: Record<string, string>,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Template');

    // Definir colunas (sem 'imagens' — agora são embutidas)
    const columns = columnDefinitions.map((col) => ({
      header: col.name,
      key: col.name,
      width: Math.max(col.name.length + 5, 15),
    }));
    worksheet.columns = columns;

    // Estilizar header
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      const colDef = columnDefinitions[colNumber - 1];
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: colDef?.required ? 'FF2563EB' : 'FF6B7280' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
      };

      // Adicionar nota/comentário com instrução
      const colName = colDef?.name;
      if (colName && instructions[colName]) {
        cell.note = {
          texts: [
            {
              text: `${colDef.required ? '(Obrigatório) ' : '(Opcional) '}${instructions[colName]}`,
              font: { size: 10 },
            },
          ],
        };
      }
    });

    // Adicionar linha de exemplo
    const exampleRow: Record<string, any> = {};
    columnDefinitions.forEach((col) => {
      if (exampleData[col.name] !== undefined) {
        exampleRow[col.name] = exampleData[col.name];
      }
    });
    worksheet.addRow(exampleRow);

    // Estilizar linha de exemplo
    const exRow = worksheet.getRow(2);
    exRow.eachCell((cell) => {
      cell.font = { italic: true, color: { argb: 'FF9CA3AF' } };
    });

    // Adicionar aba de instruções
    const instrSheet = workbook.addWorksheet('Instruções');
    instrSheet.columns = [
      { header: 'Coluna', key: 'coluna', width: 20 },
      { header: 'Obrigatório', key: 'obrigatorio', width: 15 },
      { header: 'Tipo', key: 'tipo', width: 15 },
      { header: 'Descrição', key: 'descricao', width: 60 },
    ];

    // Estilizar header da aba de instruções
    const instrHeader = instrSheet.getRow(1);
    instrHeader.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2563EB' },
      };
    });

    columnDefinitions.forEach((col) => {
      instrSheet.addRow({
        coluna: col.name,
        obrigatorio: col.required ? 'Sim' : 'Não',
        tipo: col.type,
        descricao: instructions[col.name] || '',
      });
    });

    // Adicionar instrução sobre imagens
    instrSheet.addRow({});
    instrSheet.addRow({
      coluna: '📷 IMAGENS',
      obrigatorio: '',
      tipo: '',
      descricao:
        'Para adicionar imagens, insira-as diretamente na planilha (aba Template). Cole/insira a imagem na linha do produto correspondente. A primeira imagem de cada linha será a principal.',
    });

    const xlsxBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(xlsxBuffer);
  }
}
