import { Injectable, Logger } from '@nestjs/common';
import { DocuSignClient } from './docusign.client';
import { CreateEnvelopeDto } from './dto/request/create-envelope.dto';
import { CreateEnvelopeResponseDto } from './dto/response/create-envelope-response.dto';
import { EnvelopeStatus } from './enums/envelope-status.enum';
import { DocumentDto } from './dto/request/document.dto';
import { TabsDto } from './dto/request/tabs/tabs.dto';
import {
  EnvelopeCreationFailedException,
  ProviderUnavailableException,
  ProviderTimeoutException,
} from 'src/shared/exceptions/custom-exceptions';
import { CreateTemplateEnvelopeDto } from './dto/request/create-template-envelope.dto';

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

  /**
   * Cria um envelope a partir de um template DocuSign com campos pré-preenchidos
   *
   * IMPORTANTE: Este método usa o fluxo DocGen (AceGen) de 4 etapas:
   * 1. Criar envelope como DRAFT (status: 'created')
   * 2. GET docGenFormFields para obter os IDs internos dos campos
   * 3. PUT docGenFormFields com os valores mapeados por label
   * 4. PUT status: 'sent' para enviar o envelope
   *
   * @param params.templateId - ID do template no DocuSign
   * @param params.buyerEmail - Email do comprador
   * @param params.buyerName - Nome do comprador
   * @param params.sellerEmail - Email do vendedor
   * @param params.sellerName - Nome do vendedor
   * @param params.formFields - Campos do formulário para preencher no contrato
   * @param params.processId - ID do processo para rastreabilidade
   * @returns Promise<{envelopeId: string; status: EnvelopeStatus}>
   *
   * @throws EnvelopeCreationFailedException - Falha ao criar envelope
   * @throws ProviderUnavailableException - DocuSign indisponível
   * @throws ProviderTimeoutException - Timeout na requisição
   */
  async createEnvelopeFromTemplate(params: {
    templateId: string;
    buyerEmail: string;
    buyerName: string;
    sellerEmail: string;
    sellerName: string;
    formFields: Record<string, string>;
    processId: string;
  }): Promise<{ envelopeId: string; status: EnvelopeStatus }> {
    const {
      templateId,
      buyerEmail,
      buyerName,
      sellerEmail,
      sellerName,
      formFields,
      processId,
    } = params;

    try {
      // 1. Validações básicas
      if (!templateId || templateId.trim().length === 0) {
        throw new EnvelopeCreationFailedException('Template ID é obrigatório');
      }

      if (!buyerEmail || buyerEmail.trim().length === 0) {
        throw new EnvelopeCreationFailedException(
          'Email do comprador é obrigatório',
        );
      }

      if (!sellerEmail || sellerEmail.trim().length === 0) {
        throw new EnvelopeCreationFailedException(
          'Email do vendedor é obrigatório',
        );
      }

      this.logger.log(`=== INICIANDO FLUXO DOCGEN DE 4 ETAPAS ===`);
      this.logger.log(`Buyer: ${buyerEmail}, Seller: ${sellerEmail}`);
      this.logger.debug(`Template ID: ${templateId}`);
      this.logger.debug(`Process ID: ${processId}`);
      this.logger.debug(`Form fields count: ${Object.keys(formFields).length}`);

      // ===== ETAPA 1: CRIAR ENVELOPE COMO DRAFT =====
      this.logger.log('ETAPA 1: Criando envelope como DRAFT...');

      const createEnvelopeDto: CreateTemplateEnvelopeDto = {
        templateId,
        status: 'created', // DRAFT - não envia ainda
        emailSubject: 'Contrato de Compra e Venda - Assinatura Digital',
        templateRoles: [
          {
            roleName: 'Buyer',
            name: buyerName,
            email: buyerEmail,
          },
          {
            roleName: 'Seller',
            name: sellerName,
            email: sellerEmail,
          },
        ],
        customFields: {
          textCustomFields: [
            {
              name: 'processId',
              value: processId,
            },
          ],
        },
      };

      const draftResponse =
        await this.client.createEnvelopeFromTemplate(createEnvelopeDto);
      const envelopeId = draftResponse.envelopeId;

      this.logger.log(`✓ Envelope DRAFT criado. ID: ${envelopeId}`);

      // ===== ETAPA 2: BUSCAR CAMPOS DOCGEN =====
      this.logger.log('ETAPA 2: Buscando campos DocGen do envelope...');

      const docGenFieldsResponse =
        await this.client.getEnvelopeDocGenFormFields(envelopeId);

      this.logger.debug(
        `DocGen fields response: ${JSON.stringify(docGenFieldsResponse, null, 2)}`,
      );

      // ===== ETAPA 3: MAPEAR E ATUALIZAR CAMPOS =====
      this.logger.log('ETAPA 3: Mapeando e atualizando campos DocGen...');

      // docGenFieldsResponse.docGenFormFields é array de documentos
      // Cada documento tem docGenFormFieldList com os campos
      const updatedDocGenFormFields = this.mapFormFieldsToDocGen(
        docGenFieldsResponse.docGenFormFields,
        formFields,
      );

      this.logger.debug(
        `Updated DocGen fields: ${JSON.stringify(updatedDocGenFormFields, null, 2)}`,
      );

      await this.client.updateEnvelopeDocGenFormFields(envelopeId, {
        docGenFormFields: updatedDocGenFormFields,
      });

      this.logger.log(`✓ Campos DocGen atualizados`);

      // ===== ETAPA 4: ENVIAR ENVELOPE =====
      this.logger.log('ETAPA 4: Enviando envelope (status: sent)...');

      await this.client.updateEnvelopeStatus(envelopeId, 'sent');

      this.logger.log(`✓ Envelope enviado com sucesso!`);
      this.logger.log(`=== FLUXO DOCGEN CONCLUÍDO ===`);

      return {
        envelopeId,
        status: EnvelopeStatus.SENT,
      };
    } catch (error) {
      // Tratamento de erros com categorização

      if (
        error instanceof ProviderUnavailableException ||
        error instanceof ProviderTimeoutException
      ) {
        this.logger.error(
          `Erro de resiliência ao criar envelope via template: ${error.message}`,
        );
        throw error;
      }

      if (error instanceof EnvelopeCreationFailedException) {
        this.logger.error(`Validação falhou: ${error.message}`);
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Erro inesperado ao criar envelope via template: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new EnvelopeCreationFailedException(
        `Falha ao criar envelope via template: ${errorMessage}`,
      );
    }
  }

  /**
   * Cria um envelope em modo DRAFT e retorna URL do Sender View para preview
   *
   * Este método reutiliza a lógica do createEnvelopeFromTemplate até a etapa 3
   * (preenchimento dos campos DocGen), mas em vez de enviar o envelope,
   * cria uma URL do Sender View para que o usuário possa visualizar e editar
   * antes de confirmar o envio.
   *
   * Fluxo:
   * 1. Criar envelope como DRAFT
   * 2. Preencher campos DocGen
   * 3. Criar URL do Sender View (em vez de enviar)
   * 4. Retornar URL + envelopeId + expiresAt
   *
   * A URL retornada expira em 10 minutos (limitação da API DocuSign).
   *
   * @param params.templateId - ID do template no DocuSign
   * @param params.buyerEmail - Email do comprador
   * @param params.buyerName - Nome do comprador
   * @param params.sellerEmail - Email do vendedor
   * @param params.sellerName - Nome do vendedor
   * @param params.formFields - Campos do formulário para preencher no contrato
   * @param params.processId - ID do processo para rastreabilidade
   * @param params.returnUrl - URL de callback após ação no Sender View
   * @returns Promise<{ envelopeId, previewUrl, expiresAt }>
   */
  async createEnvelopePreview(params: {
    templateId: string;
    buyerEmail: string;
    buyerName: string;
    sellerEmail: string;
    sellerName: string;
    formFields: Record<string, string>;
    processId: string;
    returnUrl: string;
  }): Promise<{
    envelopeId: string;
    previewUrl: string;
    expiresAt: string;
  }> {
    const {
      templateId,
      buyerEmail,
      buyerName,
      sellerEmail,
      sellerName,
      formFields,
      processId,
      returnUrl,
    } = params;

    try {
      // Validações básicas
      if (!templateId || templateId.trim().length === 0) {
        throw new EnvelopeCreationFailedException('Template ID é obrigatório');
      }

      if (!buyerEmail || buyerEmail.trim().length === 0) {
        throw new EnvelopeCreationFailedException(
          'Email do comprador é obrigatório',
        );
      }

      if (!sellerEmail || sellerEmail.trim().length === 0) {
        throw new EnvelopeCreationFailedException(
          'Email do vendedor é obrigatório',
        );
      }

      if (!returnUrl || returnUrl.trim().length === 0) {
        throw new EnvelopeCreationFailedException('Return URL é obrigatório');
      }

      this.logger.log(`=== INICIANDO FLUXO DE PREVIEW (3 ETAPAS) ===`);
      this.logger.log(`Buyer: ${buyerEmail}, Seller: ${sellerEmail}`);
      this.logger.debug(`Template ID: ${templateId}`);
      this.logger.debug(`Process ID: ${processId}`);
      this.logger.debug(`Return URL: ${returnUrl}`);

      // ===== ETAPA 1: CRIAR ENVELOPE COMO DRAFT =====
      this.logger.log('PREVIEW ETAPA 1: Criando envelope como DRAFT...');

      const createEnvelopeDto: CreateTemplateEnvelopeDto = {
        templateId,
        status: 'created', // DRAFT - não envia
        emailSubject: 'Contrato de Compra e Venda - Assinatura Digital',
        templateRoles: [
          {
            roleName: 'Buyer',
            name: buyerName,
            email: buyerEmail,
          },
          {
            roleName: 'Seller',
            name: sellerName,
            email: sellerEmail,
          },
        ],
        customFields: {
          textCustomFields: [
            {
              name: 'processId',
              value: processId,
            },
          ],
        },
      };

      const draftResponse =
        await this.client.createEnvelopeFromTemplate(createEnvelopeDto);
      const envelopeId = draftResponse.envelopeId;

      this.logger.log(`✓ Envelope DRAFT criado. ID: ${envelopeId}`);

      // ===== ETAPA 2: BUSCAR E ATUALIZAR CAMPOS DOCGEN =====
      this.logger.log('PREVIEW ETAPA 2: Preenchendo campos DocGen...');

      const docGenFieldsResponse =
        await this.client.getEnvelopeDocGenFormFields(envelopeId);

      const updatedDocGenFormFields = this.mapFormFieldsToDocGen(
        docGenFieldsResponse.docGenFormFields,
        formFields,
      );

      await this.client.updateEnvelopeDocGenFormFields(envelopeId, {
        docGenFormFields: updatedDocGenFormFields,
      });

      this.logger.log(`✓ Campos DocGen atualizados`);

      // ===== ETAPA 3: CRIAR URL DO SENDER VIEW =====
      this.logger.log('PREVIEW ETAPA 3: Criando URL do Sender View...');

      const senderViewResponse = await this.client.createSenderView(
        envelopeId,
        returnUrl,
        {
          startingScreen: 'Tagger',
          showBackButton: 'false',
          showEditRecipients: 'false',
          showEditDocuments: 'true',
          showDiscardAction: 'false',
          sendButtonAction: 'send',
        },
      );

      // A URL expira em 10 minutos
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      this.logger.log(`✓ Sender View URL criada`);
      this.logger.log(`=== PREVIEW PRONTO ===`);

      return {
        envelopeId,
        previewUrl: senderViewResponse.url,
        expiresAt,
      };
    } catch (error) {
      if (
        error instanceof ProviderUnavailableException ||
        error instanceof ProviderTimeoutException
      ) {
        this.logger.error(`Erro de resiliência no preview: ${error.message}`);
        throw error;
      }

      if (error instanceof EnvelopeCreationFailedException) {
        this.logger.error(`Validação falhou no preview: ${error.message}`);
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Erro inesperado no preview: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new EnvelopeCreationFailedException(
        `Falha ao criar preview do envelope: ${errorMessage}`,
      );
    }
  }

  /**
   * Envia um envelope que está em modo DRAFT (após preview)
   *
   * Usado quando o usuário confirma o envio após visualizar o preview.
   *
   * @param envelopeId - ID do envelope em modo draft
   * @returns Promise<{ envelopeId, status }>
   */
  async sendDraftEnvelope(
    envelopeId: string,
  ): Promise<{ envelopeId: string; status: EnvelopeStatus }> {
    this.logger.log(`Enviando envelope DRAFT ${envelopeId}...`);

    try {
      await this.client.updateEnvelopeStatus(envelopeId, 'sent');

      this.logger.log(`✓ Envelope ${envelopeId} enviado com sucesso`);

      return {
        envelopeId,
        status: EnvelopeStatus.SENT,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(`Erro ao enviar envelope draft: ${errorMessage}`);

      throw new EnvelopeCreationFailedException(
        `Falha ao enviar envelope: ${errorMessage}`,
      );
    }
  }

  /**
   * Cancela (void) um envelope draft que não será enviado
   *
   * @param envelopeId - ID do envelope
   * @param reason - Motivo do cancelamento
   */
  async voidDraftEnvelope(envelopeId: string, reason: string): Promise<void> {
    this.logger.log(`Cancelando envelope draft ${envelopeId}: ${reason}`);

    try {
      await this.client.voidEnvelope(envelopeId, reason);
      this.logger.log(`✓ Envelope ${envelopeId} cancelado`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(`Erro ao cancelar envelope: ${errorMessage}`);
      // Não relançamos o erro - cancelamento é best-effort
    }
  }

  /**
   * Mapeia os campos do formulário para a estrutura DocGen
   *
   * A API DocuSign retorna os campos com 'name' (ID interno) e 'label'.
   * Precisamos encontrar o 'name' correspondente ao 'label' e atribuir o valor.
   *
   * @param docGenFormFields - Array de documentos com campos DocGen da API
   * @param formFields - Mapa de label -> valor do formulário
   * @returns Array de documentos com campos DocGen atualizados
   */
  private mapFormFieldsToDocGen(
    docGenFormFields: any[],
    formFields: Record<string, string>,
  ): any[] {
    if (!docGenFormFields || !Array.isArray(docGenFormFields)) {
      this.logger.warn('docGenFormFields está vazio ou não é um array');
      return [];
    }

    return docGenFormFields.map((doc: any) => {
      const docGenFormFieldList = (doc.docGenFormFieldList || []).map(
        (field: any) => {
          const label = field.label;
          const value = formFields[label];

          if (value !== undefined) {
            this.logger.debug(
              `Mapeando campo: label="${label}" -> name="${field.name}" = "${value}"`,
            );
            return {
              name: field.name,
              value: String(value),
            };
          } else {
            this.logger.debug(
              `Campo não encontrado no formulário: label="${label}"`,
            );
            return {
              name: field.name,
              value: field.value || '', // Manter valor existente ou vazio
            };
          }
        },
      );

      return {
        documentId: doc.documentId,
        docGenFormFieldList,
      };
    });
  }
}
