/**
 * Representa um erro em uma linha específica da planilha
 */
export interface ImportErrorRow {
  /** Número da linha na planilha (1-indexed, excluindo header) */
  row: number;
  /** Mensagem de erro explicativa */
  reason: string;
  /** Campos da linha que causaram o erro (para debug/exibição) */
  fields?: Record<string, any>;
  /** Avisos de imagem (falhas parciais — produto criado, mas algumas imagens falharam) */
  imageWarnings?: string[];
}

/**
 * Resposta padrão para importação de planilha XLSX
 */
export interface ImportResponseDto {
  /** Indica se a operação foi bem sucedida (pode ter erros parciais) */
  success: boolean;
  /** Mensagem geral sobre a importação */
  message: string;
  /** Quantidade de produtos inseridos com sucesso */
  insertedCount: number;
  /** Quantidade de produtos atualizados (match por marca + modelo + especialista) */
  updatedCount: number;
  /** Quantidade de linhas com erro (produto não criado) */
  errorCount: number;
  /** Quantidade de produtos criados com avisos de imagem */
  warningCount: number;
  /** Detalhes de cada linha com erro */
  errorRows: ImportErrorRow[];
  /** Produtos criados com falhas parciais de imagem */
  warningRows: ImportErrorRow[];
  /** IDs dos produtos inseridos (opcional) */
  insertedIds?: number[];
  /** IDs dos produtos atualizados (opcional) */
  updatedIds?: number[];
  /** Quantidade de produtos inativados por ausência na planilha */
  deactivatedCount: number;
  /** IDs dos produtos inativados por ausência na planilha */
  deactivatedIds: number[];
  /** Quantidade de produtos reativados (voltaram na planilha) */
  reactivatedCount: number;
}

/**
 * Estrutura esperada de uma linha da planilha após parsing
 */
export interface ImportParsedRow {
  [key: string]: string;
}

/**
 * Resultado da validação de estrutura da planilha
 */
export interface ImportStructureValidation {
  valid: boolean;
  errors: string[];
  /** Colunas encontradas na planilha */
  foundColumns: string[];
  /** Colunas obrigatórias que estão faltando */
  missingRequired: string[];
  /** Colunas na planilha que não são reconhecidas */
  unknownColumns: string[];
}

// Aliases para retrocompatibilidade interna (facilita migração)
export type CsvImportResponseDto = ImportResponseDto;
export type CsvErrorRow = ImportErrorRow;
export type CsvParsedRow = ImportParsedRow;
export type CsvStructureValidation = ImportStructureValidation;
