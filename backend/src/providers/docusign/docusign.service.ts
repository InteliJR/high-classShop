import { Injectable, Logger } from '@nestjs/common';
import { DocuSignClient } from './docusign.client';
import { CreateEnvelopeDto } from './dto/request/create-envelope.dto';
import { CreateEnvelopeResponseDto } from './dto/response/create-envelope-response.dto';
import { EnvelopeStatus } from './enums/envelope-status.enum';
import { DocumentDto } from './dto/request/document.dto';
import { TabsDto } from './dto/request/tabs/tabs.dto';
import { $Enums } from '@prisma/client';
import {
  EnvelopeCreationFailedException,
  ProviderUnavailableException,
  ProviderTimeoutException,
} from 'src/shared/exceptions/custom-exceptions';

/**
 * Serviço de integração com DocuSign
 *
 * Responsabilidades:
 * - Converter PDFs em base64 (preparar documento)
 * - Montar payloads de envelope (estrutura de assinatura)
 * - Criar envelopes na API DocuSign (enviar para assinatura)
 * - Consultar status de envelopes
 * - Tratamento robusto de erros do provedor
 *
 * Segurança:
 * - Logs detalhados para auditoria
 * - Exceções customizadas sem expor detalhes internos
 * - Validação básica de entrada (não nulo/vazio)
 */
@Injectable()
export class DocuSignService {
  private readonly logger = new Logger(DocuSignService.name);

  constructor(private readonly client: DocuSignClient) {}

  /**
   * Cria um envelope na DocuSign com um documento PDF e um signer
   *
   * Fluxo:
   * 1. Validar entrada (pdfBuffer, emails)
   * 2. Converter PDF para base64
   * 3. Montar estrutura do documento (document DTO)
   * 4. Definir posições de assinatura (text anchors)
   * 5. Criar signer com tabs
   * 6. Montar envelope DTO
   * 7. Enviar para DocuSign via cliente
   * 8. Tratar erros e retornar resposta
   *
   * @param params.pdfBuffer - Buffer do PDF (já processado)
   * @param params.clientEmail - Email do cliente que irá assinar
   * @param params.clientName - Nome do cliente
   * @returns Promise<{envelopeId: string; status: EnvelopeStatus}>
   *
   * @throws EnvelopeCreationFailedException - Falha ao criar envelope
   * @throws ProviderUnavailableException - DocuSign indisponível
   * @throws ProviderTimeoutException - Timeout na requisição
   */
  async createEnvelope(params: {
    pdfBuffer: Buffer;
    clientEmail: string;
    clientName: string;
  }): Promise<{ envelopeId: string; status: EnvelopeStatus }> {
    const { pdfBuffer, clientEmail, clientName } = params;

    try {
      // 1. Validações básicas
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new EnvelopeCreationFailedException(
          'PDF buffer é vazio ou inválido',
        );
      }

      if (!clientEmail || clientEmail.trim().length === 0) {
        throw new EnvelopeCreationFailedException(
          'Email do cliente é obrigatório',
        );
      }

      if (!clientName || clientName.trim().length === 0) {
        throw new EnvelopeCreationFailedException(
          'Nome do cliente é obrigatório',
        );
      }

      this.logger.log(`Criando envelope para ${clientEmail}...`);

      // 2. Converter PDF para base64
      const pdfBase64 = pdfBuffer.toString('base64');
      this.logger.debug(
        `PDF convertido para base64 (tamanho: ${pdfBase64.length} chars)`,
      );

      // 3. Criar DTO do documento
      const document: DocumentDto = {
        documentBase64: pdfBase64,
        documentId: '1',
        fileExtension: 'pdf',
        name: 'Contract.pdf',
      };

      // 4. Definir posições de assinatura usando text anchors
      // Text anchors são strings no PDF que a DocuSign procura e substitui
      // pelos campos de assinatura (signature pad, name field, date field)
      const tabs: TabsDto = {
        signHereTabs: [
          {
            anchorString: 'client_signature',
            anchorUnits: 'pixels',
            recipientId: '1',
            tabLabel: 'Signature',
          } as any,
        ],
        fullNameTabs: [
          {
            anchorString: 'client_name',
            anchorUnits: 'pixels',
            recipientId: '1',
            tabLabel: 'Full Name',
          } as any,
        ],
        dateSignedTabs: [
          {
            anchorString: 'client_date',
            anchorUnits: 'pixels',
            recipientId: '1',
            tabLabel: 'Date',
          } as any,
        ],
      };

      this.logger.debug(
        `Tabs de assinatura configurados (${Object.keys(tabs).length} tipos)`,
      );

      // 5. Criar signer com email e tabs
      const signer = {
        email: clientEmail,
        name: clientName,
        recipientId: '1',
        routingOrder: '1',
        tabs,
      };

      // 6. Montar DTO do envelope
      const createEnvelopeDto: CreateEnvelopeDto = {
        documents: [document],
        emailSubject: 'Por favor, assine este contrato',
        recipients: {
          signers: [signer],
        },
        status: EnvelopeStatus.SENT, // Enviar imediatamente para o signer
      };

      this.logger.debug(`Envelope DTO montado`);

      // 7. Enviar para DocuSign via cliente
      // O cliente (DocuSignClient) trata retry, timeout, e exceções
      const response = await this.client.createEnvelope(createEnvelopeDto);

      this.logger.log(
        `✓ Envelope criado com sucesso. ID: ${response.envelopeId}, Status: ${response.status}`,
      );

      return {
        envelopeId: response.envelopeId,
        status: response.status,
      };
    } catch (error) {
      // Tratamento de erros com categorização

      // Se é erro de resiliência do cliente, re-lança (já é uma exceção customizada)
      if (
        error instanceof ProviderUnavailableException ||
        error instanceof ProviderTimeoutException
      ) {
        this.logger.error(
          `Erro de resiliência ao criar envelope: ${error.message}`,
        );
        throw error;
      }

      // Se é erro de validação de entrada, re-lança
      if (error instanceof EnvelopeCreationFailedException) {
        this.logger.error(`Validação falhou: ${error.message}`);
        throw error;
      }

      // Erro inesperado
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Erro inesperado ao criar envelope: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new EnvelopeCreationFailedException(
        `Falha geral ao criar envelope: ${errorMessage}`,
      );
    }
  }

  /**
   * Consulta o status de um envelope
   *
   * @param envelopeId - ID do envelope na DocuSign
   * @returns Promise<CreateEnvelopeResponseDto> - Dados atualizados do envelope
   * @throws ProviderUnavailableException - DocuSign indisponível
   */
  async getEnvelopeStatus(
    envelopeId: string,
  ): Promise<CreateEnvelopeResponseDto> {
    try {
      this.logger.log(`Consultando status do envelope ${envelopeId}...`);

      if (!envelopeId || envelopeId.trim().length === 0) {
        throw new Error('Envelope ID é obrigatório');
      }

      const response = await this.client.getEnvelope(envelopeId);

      this.logger.log(`Status do envelope ${envelopeId}: ${response.status}`);

      return response;
    } catch (error) {
      if (
        error instanceof ProviderUnavailableException ||
        error instanceof ProviderTimeoutException
      ) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Erro ao consultar status do envelope: ${errorMessage}`,
      );

      throw new ProviderUnavailableException(
        'DocuSign',
        `Falha ao consultar envelope ${envelopeId}`,
      );
    }
  }

  /**
   * Cancela um envelope (void)
   *
   * Nota: Implementação incompleta
   * ENDPOINT: PUT /v2.1/accounts/{accountId}/envelopes/{envelopeId}
   * BODY: { "status": "voided", "voidedReason": "..." }
   *
   * @param envelopeId - ID do envelope a cancelar
   */
  async voidEnvelope(envelopeId: string): Promise<void> {
    try {
      // TODO: Implementar chamada PUT para void envelope
      this.logger.log(
        `Envelope ${envelopeId} marcado para cancelamento (NOT IMPLEMENTED)`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(`Erro ao cancelar envelope: ${errorMessage}`);

      throw new ProviderUnavailableException(
        'DocuSign',
        `Falha ao cancelar envelope`,
      );
    }
  }
}
