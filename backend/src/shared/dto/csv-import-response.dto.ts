/**
 * Representa um erro em uma linha específica do CSV
 */
export interface CsvErrorRow {
  /** Número da linha no CSV (1-indexed, excluindo header) */
  row: number;
  /** Mensagem de erro explicativa */
  reason: string;
  /** Campos da linha que causaram o erro (para debug/exibição) */
  fields?: Record<string, any>;
}

/**
 * Resposta padrão para importação de CSV
 */
export interface CsvImportResponseDto {
  /** Indica se a operação foi bem sucedida (pode ter erros parciais) */
  success: boolean;
  /** Mensagem geral sobre a importação */
  message: string;
  /** Quantidade de produtos inseridos com sucesso */
  insertedCount: number;
  /** Quantidade de linhas com erro */
  errorCount: number;
  /** Detalhes de cada linha com erro */
  errorRows: CsvErrorRow[];
  /** IDs dos produtos inseridos (opcional) */
  insertedIds?: number[];
}

/**
 * Estrutura esperada de uma linha do CSV após parsing
 */
export interface CsvParsedRow {
  [key: string]: string;
}

/**
 * Resultado da validação de estrutura do CSV
 */
export interface CsvStructureValidation {
  valid: boolean;
  errors: string[];
  /** Colunas encontradas no CSV */
  foundColumns: string[];
  /** Colunas obrigatórias que estão faltando */
  missingRequired: string[];
  /** Colunas no CSV que não são reconhecidas */
  unknownColumns: string[];
}
