/**
 * Utilitários para validação de PDF
 *
 * Responsabilidades:
 * - Verificar MIME type correto
 * - Validar Magic Numbers (assinatura do arquivo)
 * - Verificar tamanho máximo
 * - Detectar PDFs corrompidos
 *
 * Por que isso importa:
 * - Evita spoofing de extensão (ex: .exe renomeado como .pdf)
 * - Detecta uploads maliciosos antes do processamento
 * - Protege contra DoS (arquivos gigantescos)
 */

import { InvalidPdfException, FileTooLargeException, InvalidMimeTypeException } from '../exceptions/custom-exceptions';

/**
 * Configurações de validação de PDF
 */
export const PDF_VALIDATION_CONFIG = {
  // Tamanho máximo em bytes (10 MB)
  MAX_FILE_SIZE: 10 * 1024 * 1024,

  // MIME types aceitos
  ALLOWED_MIME_TYPES: ['application/pdf', 'application/x-pdf'],

  // Magic Number do PDF (primeiros bytes do arquivo)
  // Todo PDF começa com: 0x25 0x50 0x44 0x46 ('%PDF')
  PDF_MAGIC_NUMBER: Buffer.from([0x25, 0x50, 0x44, 0x46]), // %PDF
};

/**
 * Valida se um buffer é um PDF legítimo
 *
 * @param buffer - Buffer do arquivo
 * @param mimeType - MIME type declarado pelo cliente
 * @param fileName - Nome do arquivo (para mensagens de erro)
 * @returns true se válido, senão lança exceção
 */
export function validatePdfFile(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): boolean {
  // 1. Validar MIME type
  if (!PDF_VALIDATION_CONFIG.ALLOWED_MIME_TYPES.includes(mimeType?.toLowerCase())) {
    throw new InvalidMimeTypeException(
      mimeType || 'unknown',
      PDF_VALIDATION_CONFIG.ALLOWED_MIME_TYPES,
    );
  }

  // 2. Validar tamanho
  if (buffer.byteLength > PDF_VALIDATION_CONFIG.MAX_FILE_SIZE) {
    throw new FileTooLargeException(
      PDF_VALIDATION_CONFIG.MAX_FILE_SIZE / (1024 * 1024),
      `Arquivo '${fileName}' é muito grande (${formatBytes(buffer.byteLength)}). Máximo: ${PDF_VALIDATION_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`,
    );
  }

  // 3. Validar Magic Number (primeiros 4 bytes devem ser '%PDF')
  if (buffer.length < 4) {
    throw new InvalidPdfException(
      `Arquivo '${fileName}' é muito pequeno para ser um PDF válido`,
    );
  }

  const fileMagic = buffer.subarray(0, 4);
  if (!fileMagic.equals(PDF_VALIDATION_CONFIG.PDF_MAGIC_NUMBER)) {
    throw new InvalidPdfException(
      `Arquivo '${fileName}' não é um PDF válido. Magic number não corresponde.`,
    );
  }

  // 4. Validar estrutura básica (procurar por %%EOF no final)
  const fileEnd = buffer.subarray(-20).toString('utf8', 0, 20);
  if (!fileEnd.includes('%%EOF') && !fileEnd.includes('%EOF')) {
    throw new InvalidPdfException(
      `Arquivo '${fileName}' parece corrompido (ausência de marcador EOF)`,
    );
  }

  return true;
}

/**
 * Formata bytes para formato legível (ex: 1.5 MB)
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Calcula hash MD5 do arquivo (para detecção de duplicatas)
 * Use isso para evitar reprocessar o mesmo PDF
 *
 * @param buffer - Buffer do arquivo
 * @returns String hexadecimal do MD5
 */
export function calculatePdfHash(buffer: Buffer): string {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(buffer).digest('hex');
}
