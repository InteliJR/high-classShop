/**
 * Response DTO para a criação de preview de contrato
 *
 * Contém a URL do DocuSign Sender View para visualização
 * e edição do contrato antes do envio.
 */
export class PreviewContractResponseDto {
  /**
   * URL do DocuSign Sender View para visualização/edição do contrato
   * URL expira em aproximadamente 10 minutos
   * @example "https://demo.docusign.net/Sender/..."
   */
  preview_url: string;

  /**
   * ID do envelope no DocuSign (formato GUID)
   * Necessário para enviar o contrato após preview
   * @example "93be49ab-xxxx-xxxx-xxxx-f752070d71ec"
   */
  envelope_id: string;

  /**
   * Timestamp de quando o envelope expira (24h para drafts)
   * Após esse tempo, o envelope draft é descartado automaticamente
   * @example "2026-02-19T10:35:00.000Z"
   */
  expires_at: string;

  /**
   * ID do processo associado ao envelope
   * @example "550e8400-e29b-41d4-a716-446655440000"
   */
  process_id: string;
}

/**
 * Response DTO para confirmação de envio do contrato após preview
 */
export class SendContractResponseDto {
  /**
   * ID do contrato criado no banco de dados
   */
  id: string;

  /**
   * ID do envelope enviado
   */
  envelope_id: string;

  /**
   * ID do processo
   */
  process_id: string;

  /**
   * Status do contrato
   */
  status: string;

  /**
   * Timestamp de criação
   */
  created_at: string;
}
