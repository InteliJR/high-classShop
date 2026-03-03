import { Injectable, BadRequestException } from '@nestjs/common';
import { validate, ValidationError } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CsvImportResponseDto,
  CsvErrorRow,
  CsvParsedRow,
  CsvStructureValidation,
} from '../dto/csv-import-response.dto';

/**
 * Definição de colunas para validação de estrutura do CSV
 */
export interface CsvColumnDefinition {
  name: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean';
}

@Injectable()
export class CsvImportService {
  /**
   * Parseia o conteúdo CSV para um array de objetos
   */
  parseCSV(csvContent: string): CsvParsedRow[] {
    const lines = csvContent.split(/\r?\n/).filter((line) => line.trim());

    if (lines.length < 2) {
      throw new BadRequestException(
        'CSV deve conter pelo menos o cabeçalho e uma linha de dados.',
      );
    }

    // Parse do header - suporta vírgula e ponto-e-vírgula como delimitador
    const delimiter = lines[0].includes(';') ? ';' : ',';
    const headers = this.parseCsvLine(lines[0], delimiter).map((h) =>
      h.trim().toLowerCase(),
    );

    // Parse das linhas de dados
    const rows: CsvParsedRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i], delimiter);

      if (values.length !== headers.length) {
        continue; // Ignora linhas com número incorreto de colunas (será reportado na validação)
      }

      const row: CsvParsedRow = {};
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() || '';
      });
      rows.push(row);
    }

    return rows;
  }

  /**
   * Parseia uma linha CSV respeitando aspas
   */
  private parseCsvLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);

    return result;
  }

  /**
   * Valida a estrutura do CSV (colunas obrigatórias e reconhecidas)
   */
  validateStructure(
    csvContent: string,
    columnDefinitions: CsvColumnDefinition[],
  ): CsvStructureValidation {
    const lines = csvContent.split(/\r?\n/).filter((line) => line.trim());

    if (lines.length === 0) {
      return {
        valid: false,
        errors: ['CSV está vazio.'],
        foundColumns: [],
        missingRequired: [],
        unknownColumns: [],
      };
    }

    const delimiter = lines[0].includes(';') ? ';' : ',';
    const foundColumns = this.parseCsvLine(lines[0], delimiter).map((h) =>
      h.trim().toLowerCase(),
    );

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

    if (lines.length < 2) {
      errors.push(
        'CSV deve conter pelo menos uma linha de dados além do cabeçalho.',
      );
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
    row: CsvParsedRow,
    DtoClass: new () => T,
    rowNumber: number,
  ): Promise<{ valid: boolean; errors: string[]; instance?: T }> {
    // Converte tipos antes de validar
    const converted = this.convertTypes(row);

    // Cria instância do DTO
    const instance = plainToInstance(DtoClass, converted, {
      enableImplicitConversion: true,
    });

    // Valida usando class-validator
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
   * Parseia um campo delimitado por pipe (|) para obter múltiplas URLs/base64 de imagem.
   * @param value Valor da coluna 'imagens' (pode ser null/undefined/vazio)
   * @param delimiter Caractere delimitador (default: '|')
   * @param maxImages Limite máximo de imagens por produto (default: 20)
   * @returns Array de strings (URLs ou base64), vazio se não houver imagens
   */
  parseDelimitedImages(
    value: string | null | undefined,
    delimiter = '|',
    maxImages = 20,
  ): string[] {
    if (!value || !value.trim()) return [];

    const images = value
      .split(delimiter)
      .map((img) => img.trim())
      .filter((img) => img.length > 0);

    if (images.length > maxImages) {
      return images.slice(0, maxImages);
    }

    return images;
  }

  /**
   * Converte strings do CSV para tipos apropriados
   */
  private convertTypes(row: CsvParsedRow): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(row)) {
      if (value === '' || value === undefined || value === null) {
        continue; // Ignora campos vazios
      }

      // Tenta converter para número
      const numValue = Number(value);
      if (!isNaN(numValue) && value.trim() !== '') {
        // Verifica se parece ser um número (evita converter coisas como "ABC123")
        if (/^-?\d+\.?\d*$/.test(value.trim())) {
          result[key] = numValue;
          continue;
        }
      }

      // Converte boolean
      if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
        result[key] = value.toLowerCase() === 'true';
        continue;
      }

      // Mantém como string
      result[key] = value;
    }

    return result;
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
    errorRows: CsvErrorRow[],
    warningRows: CsvErrorRow[] = [],
  ): CsvImportResponseDto {
    const insertedCount = insertedIds.length;
    const errorCount = errorRows.length;
    const warningCount = warningRows.length;
    const total = insertedCount + errorCount;

    let message: string;
    let success: boolean;

    if (errorCount === 0 && warningCount === 0) {
      message = `Importação concluída com sucesso. ${insertedCount} produto(s) inserido(s).`;
      success = true;
    } else if (errorCount === 0 && warningCount > 0) {
      message = `Importação concluída com avisos. ${insertedCount} produto(s) inserido(s), ${warningCount} com falhas parciais de imagem.`;
      success = true;
    } else if (insertedCount === 0) {
      message = `Importação falhou. Nenhum produto foi inserido. ${errorCount} erro(s) encontrado(s).`;
      success = false;
    } else {
      message = `Importação parcial. ${insertedCount} de ${total} produto(s) inserido(s). ${errorCount} erro(s).${warningCount > 0 ? ` ${warningCount} com avisos de imagem.` : ''}`;
      success = true;
    }

    return {
      success,
      message,
      insertedCount,
      errorCount,
      warningCount,
      errorRows,
      warningRows,
      insertedIds,
    };
  }
}
