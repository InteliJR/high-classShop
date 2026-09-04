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
import {
  EnvelopeCreationAmbiguousError,
  EnvelopeEffectError,
} from './envelope-effect.error';

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

  private async createOrRecoverTemplateEnvelope(
    dto: CreateTemplateEnvelopeDto,
    requestFingerprint: string,
    onEnvelopeCreated?: (envelopeId: string) => void,
  ): Promise<CreateEnvelopeResponseDto> {
    const transactionId = dto.transactionId;
    if (!transactionId) {
      throw new EnvelopeCreationFailedException(
        'Transaction ID da operação é obrigatório',
      );
    }
    const processId = this.getCustomFieldValue(dto, 'processId');
    if (!requestFingerprint?.trim()) {
      throw new EnvelopeCreationFailedException(
        'Fingerprint da intenção contratual é obrigatório',
      );
    }
    dto.customFields ??= {};
    dto.customFields.textCustomFields ??= [];
    dto.customFields.textCustomFields = [
      ...dto.customFields.textCustomFields.filter(
        (field) => field.name !== 'requestFingerprint',
      ),
      { name: 'requestFingerprint', value: requestFingerprint },
    ];
    const findByTransaction = (this.client as any)
      .findEnvelopesByTransactionId as
      | ((id: string) => Promise<CreateEnvelopeResponseDto[]>)
      | undefined;

    const recover = async (): Promise<CreateEnvelopeResponseDto | null> => {
      if (!findByTransaction) return null;
      const matches = await findByTransaction.call(this.client, transactionId);
      if (matches.length > 1) {
        throw new EnvelopeCreationAmbiguousError(transactionId, matches);
      }
      const recovered = matches[0] ?? null;
      if (!recovered) return null;
      const getWithCustomFields = (this.client as any)
        .getEnvelopeWithCustomFields as
        | ((id: string) => Promise<any>)
        | undefined;
      if (!getWithCustomFields) {
        throw new EnvelopeCreationAmbiguousError(
          transactionId,
          new Error('Provider custom fields unavailable'),
        );
      }
      const envelope = await getWithCustomFields.call(
        this.client,
        recovered.envelopeId,
      );
      const recoveredProcessId = this.getCustomFieldValue(
        envelope,
        'processId',
      );
      const recoveredFingerprint = this.getCustomFieldValue(
        envelope,
        'requestFingerprint',
      );
      const authoritativeStatus = envelope?.status ?? recovered.status;
      if (
        !processId ||
        recoveredProcessId !== processId ||
        recoveredFingerprint !== requestFingerprint
      ) {
        throw new EnvelopeCreationAmbiguousError(
          transactionId,
          new Error('Recovered envelope identity mismatch'),
        );
      }
      if (
        [
          EnvelopeStatus.DECLINED,
          EnvelopeStatus.VOIDED,
        ].includes(authoritativeStatus as EnvelopeStatus)
      ) {
        throw new EnvelopeCreationAmbiguousError(
          transactionId,
          new Error(`Recovered envelope is not reusable: ${authoritativeStatus}`),
        );
      }
      return { ...recovered, status: authoritativeStatus };
    };

    let existing: CreateEnvelopeResponseDto | null;
    try {
      existing = await recover();
    } catch (error) {
      if (error instanceof EnvelopeCreationAmbiguousError) throw error;
      throw new EnvelopeCreationAmbiguousError(transactionId, error);
    }
    if (existing) {
      onEnvelopeCreated?.(existing.envelopeId);
      return existing;
    }

    try {
      const created = await this.client.createEnvelopeFromTemplate(dto);
      onEnvelopeCreated?.(created.envelopeId);
      return created;
    } catch (createError) {
      if (!findByTransaction) throw createError;
      try {
        const recovered = await recover();
        if (recovered) {
          onEnvelopeCreated?.(recovered.envelopeId);
          return recovered;
        }
      } catch (recoveryError) {
        if (recoveryError instanceof EnvelopeCreationAmbiguousError) {
          throw new EnvelopeCreationAmbiguousError(transactionId, createError);
        }
      }
      if (this.isDefinitiveCreateFailure(createError)) throw createError;
      throw new EnvelopeCreationAmbiguousError(transactionId, createError);
    }
  }

  private getCustomFieldValue(
    source: {
      customFields?: {
        textCustomFields?: Array<{ name: string; value: string }>;
      };
    },
    name: string,
  ): string | null {
    const fields = source?.customFields?.textCustomFields;
    if (!Array.isArray(fields)) return null;
    const field = fields.find((candidate) => candidate?.name === name);
    return typeof field?.value === 'string' ? field.value : null;
  }

  private isDefinitiveCreateFailure(error: unknown): boolean {
    const status = (error as any)?.response?.status;
    return (
      typeof status === 'number' &&
      status >= 400 &&
      status < 500 &&
      status !== 408 &&
      status !== 429
    );
  }

  private async statusAfterSuccessfulSend(
    envelopeId: string,
  ): Promise<EnvelopeStatus> {
    let envelope: CreateEnvelopeResponseDto;
    try {
      envelope = await this.client.getEnvelope(envelopeId);
    } catch (error) {
      throw new EnvelopeEffectError(
        envelopeId,
        'SEND_INDETERMINATE',
        error,
      );
    }
    const status = envelope?.status as EnvelopeStatus | undefined;
    if (!status || status === EnvelopeStatus.CREATED) {
      return EnvelopeStatus.SENT;
    }
    if (
      [
        EnvelopeStatus.SENT,
        EnvelopeStatus.DELIVERED,
        EnvelopeStatus.COMPLETED,
      ].includes(status)
    ) {
      return status;
    }
    throw new EnvelopeEffectError(
      envelopeId,
      'SEND_INDETERMINATE',
      null,
      status,
    );
  }

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

      this.logger.log('Criando envelope...');

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
        this.logger.error('Erro de resiliência ao criar envelope');
        throw error;
      }

      // Se é erro de validação de entrada, re-lança
      if (error instanceof EnvelopeCreationFailedException) {
        this.logger.error(`Validação falhou: ${error.message}`);
        throw error;
      }

      // Erro inesperado
      this.logger.error('Erro inesperado ao criar envelope');

      throw new EnvelopeCreationFailedException(
        'O provedor não concluiu a criação do envelope.',
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

      this.logger.error('Erro ao consultar status do envelope');

      throw new ProviderUnavailableException(
        'DocuSign',
        `Falha ao consultar envelope ${envelopeId}`,
      );
    }
  }

  async getEnvelopeProcessId(envelopeId: string): Promise<string | null> {
    const envelope = await this.client.getEnvelopeWithCustomFields(envelopeId);
    const fields = envelope?.customFields?.textCustomFields;
    if (!Array.isArray(fields)) return null;
    const processField = fields.find(
      (field: any) => field?.name === 'processId',
    );
    return typeof processField?.value === 'string' ? processField.value : null;
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
      this.logger.error('Erro ao cancelar envelope');

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
   * @param params.specialistEmail - Email do especialista (para assinatura)
   * @param params.specialistName - Nome do especialista
   * @param params.formFields - Campos do formulário para preencher no contrato
   * @param params.processId - ID do processo para rastreabilidade
   * @returns Promise<{envelopeId: string; status: EnvelopeStatus}>
   *
   * @throws EnvelopeCreationFailedException - Falha ao criar envelope
   * @throws ProviderUnavailableException - DocuSign indisponível
   * @throws ProviderTimeoutException - Timeout na requisição
   */
  async createEnvelopeFromTemplate(params: {
    transactionId: string;
    templateId: string;
    buyerEmail: string;
    buyerName: string;
    sellerEmail: string;
    sellerName: string;
    specialistEmail?: string;
    specialistName?: string;
    formFields: Record<string, string>;
    processId: string;
    requestFingerprint: string;
    testimonial1Name?: string;
    testimonial1Email?: string;
    testimonial2Name?: string;
    testimonial2Email?: string;
    onEnvelopeCreated?: (envelopeId: string) => void;
  }): Promise<{ envelopeId: string; status: EnvelopeStatus }> {
    const {
      templateId,
      transactionId,
      buyerEmail,
      buyerName,
      sellerEmail,
      sellerName,
      specialistEmail,
      specialistName,
      formFields,
      processId,
      requestFingerprint,
      testimonial1Name,
      testimonial1Email,
      testimonial2Name,
      testimonial2Email,
      onEnvelopeCreated,
    } = params;

    let createdEnvelopeId: string | null = null;
    let sendAttempted = false;

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
      this.logger.debug(`Template ID: ${templateId}`);
      this.logger.debug(`Process ID: ${processId}`);
      this.logger.debug(`Form fields count: ${Object.keys(formFields).length}`);

      // ===== ETAPA 1: CRIAR ENVELOPE COMO DRAFT =====
      this.logger.log('ETAPA 1: Criando envelope como DRAFT...');

      const createEnvelopeDto: CreateTemplateEnvelopeDto = {
        transactionId,
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
          // Especialista recebe comissão e precisa assinar
          ...(specialistEmail && specialistName
            ? [
                {
                  roleName: 'Specialist',
                  name: specialistName,
                  email: specialistEmail,
                },
              ]
            : []),
          // Testemunhas são obrigatórias no template — se não fornecidas, usar placeholder
          {
            roleName: 'Testimonial1',
            name: testimonial1Name || 'Testemunha 1',
            email: testimonial1Email || sellerEmail,
          },
          {
            roleName: 'Testimonial2',
            name: testimonial2Name || 'Testemunha 2',
            email: testimonial2Email || buyerEmail,
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

      const draftResponse = await this.createOrRecoverTemplateEnvelope(
        createEnvelopeDto,
        requestFingerprint,
        onEnvelopeCreated,
      );
      const envelopeId = draftResponse.envelopeId;
      createdEnvelopeId = envelopeId;

      if (
        draftResponse.status === EnvelopeStatus.SENT ||
        draftResponse.status === EnvelopeStatus.DELIVERED ||
        draftResponse.status === EnvelopeStatus.COMPLETED
      ) {
        return { envelopeId, status: draftResponse.status };
      }

      this.logger.log(`✓ Envelope DRAFT criado. ID: ${envelopeId}`);

      // ===== ETAPA 2: BUSCAR CAMPOS DOCGEN =====
      this.logger.log('ETAPA 2: Buscando campos DocGen do envelope...');

      const docGenFieldsResponse =
        await this.client.getEnvelopeDocGenFormFields(envelopeId);

      // ===== ETAPA 3: MAPEAR E ATUALIZAR CAMPOS =====
      this.logger.log('ETAPA 3: Mapeando e atualizando campos DocGen...');

      // docGenFieldsResponse.docGenFormFields é array de documentos
      // Cada documento tem docGenFormFieldList com os campos
      const updatedDocGenFormFields = this.mapFormFieldsToDocGen(
        docGenFieldsResponse.docGenFormFields,
        formFields,
      );

      await this.client.updateEnvelopeDocGenFormFields(envelopeId, {
        docGenFormFields: updatedDocGenFormFields,
      });

      this.logger.log(`✓ Campos DocGen atualizados`);

      // ===== ETAPA 4: ENVIAR ENVELOPE =====
      this.logger.log('ETAPA 4: Enviando envelope (status: sent)...');

      sendAttempted = true;
      await this.client.updateEnvelopeStatus(envelopeId, 'sent');
      const sentStatus = await this.statusAfterSuccessfulSend(envelopeId);

      this.logger.log(`✓ Envelope enviado com sucesso!`);
      this.logger.log(`=== FLUXO DOCGEN CONCLUÍDO ===`);

      return {
        envelopeId,
        status: sentStatus,
      };
    } catch (error) {
      // Tratamento de erros com categorização

      if (
        error instanceof EnvelopeEffectError ||
        error instanceof EnvelopeCreationAmbiguousError
      ) {
        throw error;
      }

      if (createdEnvelopeId) {
        if (sendAttempted) {
          try {
            const envelope = await this.client.getEnvelope(createdEnvelopeId);
            if (
              envelope?.status === EnvelopeStatus.SENT ||
              envelope?.status === EnvelopeStatus.DELIVERED ||
              envelope?.status === EnvelopeStatus.COMPLETED
            ) {
              return {
                envelopeId: createdEnvelopeId,
                status: envelope.status,
              };
            }
            if (envelope?.status !== EnvelopeStatus.CREATED) {
              throw new EnvelopeEffectError(
                createdEnvelopeId,
                'SEND_INDETERMINATE',
                error,
              );
            }
          } catch (statusError) {
            if (statusError instanceof EnvelopeEffectError) throw statusError;
            this.logger.error(
              'Falha ao confirmar o status depois do envio do envelope',
              statusError instanceof Error ? statusError.stack : undefined,
            );
            throw new EnvelopeEffectError(
              createdEnvelopeId,
              'SEND_INDETERMINATE',
              error,
            );
          }
        }
        throw new EnvelopeEffectError(
          createdEnvelopeId,
          'DRAFT_CONFIRMED',
          error,
        );
      }

      if (
        error instanceof ProviderUnavailableException ||
        error instanceof ProviderTimeoutException
      ) {
        this.logger.error('Erro de resiliência ao criar envelope via template');
        throw error;
      }

      if (error instanceof EnvelopeCreationFailedException) {
        this.logger.error(`Validação falhou: ${error.message}`);
        throw error;
      }

      this.logger.error('Erro inesperado ao criar envelope via template');

      throw new EnvelopeCreationFailedException(
        'O provedor não concluiu a criação do envelope via template.',
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
   * @param params.returnUrl - URL de callback após sair do Sender View
   * @returns Promise<{ envelopeId, previewUrl, expiresAt }>
   */
  async createEnvelopePreview(params: {
    transactionId: string;
    templateId: string;
    buyerEmail: string;
    buyerName: string;
    sellerEmail: string;
    sellerName: string;
    specialistEmail?: string;
    specialistName?: string;
    formFields: Record<string, string>;
    processId: string;
    requestFingerprint: string;
    returnUrl: string;
    testimonial1Name?: string;
    testimonial1Email?: string;
    testimonial2Name?: string;
    testimonial2Email?: string;
    onEnvelopeCreated?: (envelopeId: string) => void;
  }): Promise<{
    envelopeId: string;
    previewUrl: string;
    expiresAt: string;
  }> {
    const {
      templateId,
      transactionId,
      buyerEmail,
      buyerName,
      sellerEmail,
      sellerName,
      specialistEmail,
      specialistName,
      formFields,
      processId,
      requestFingerprint,
      returnUrl,
      testimonial1Name,
      testimonial1Email,
      testimonial2Name,
      testimonial2Email,
      onEnvelopeCreated,
    } = params;

    let createdEnvelopeId: string | null = null;

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

      this.logger.log(`=== INICIANDO FLUXO DE PREVIEW (3 ETAPAS) ===`);
      this.logger.debug(`Template ID: ${templateId}`);
      this.logger.debug(`Process ID: ${processId}`);

      // ===== ETAPA 1: CRIAR ENVELOPE COMO DRAFT =====
      this.logger.log('PREVIEW ETAPA 1: Criando envelope como DRAFT...');

      const createEnvelopeDto: CreateTemplateEnvelopeDto = {
        transactionId,
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
          ...(specialistEmail && specialistName
            ? [
                {
                  roleName: 'Specialist',
                  name: specialistName,
                  email: specialistEmail,
                },
              ]
            : []),
          // Testemunhas são obrigatórias no template — se não fornecidas, usar placeholder
          {
            roleName: 'Testimonial1',
            name: testimonial1Name || 'Testemunha 1',
            email: testimonial1Email || sellerEmail,
          },
          {
            roleName: 'Testimonial2',
            name: testimonial2Name || 'Testemunha 2',
            email: testimonial2Email || buyerEmail,
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

      const draftResponse = await this.createOrRecoverTemplateEnvelope(
        createEnvelopeDto,
        requestFingerprint,
        onEnvelopeCreated,
      );
      const envelopeId = draftResponse.envelopeId;
      createdEnvelopeId = envelopeId;

      if (
        draftResponse.status === EnvelopeStatus.SENT ||
        draftResponse.status === EnvelopeStatus.DELIVERED ||
        draftResponse.status === EnvelopeStatus.COMPLETED
      ) {
        throw new EnvelopeEffectError(
          envelopeId,
          'SEND_CONFIRMED',
          null,
          draftResponse.status,
        );
      }

      this.logger.log(`✓ Envelope DRAFT criado. ID: ${envelopeId}`);

      // ===== ETAPA 2: BUSCAR E ATUALIZAR CAMPOS DOCGEN =====
      this.logger.log('PREVIEW ETAPA 2: Preenchendo campos DocGen...');

      const docGenFieldsResponse =
        await this.client.getEnvelopeDocGenFormFields(envelopeId);

      this.logger.log(
        `Form fields keys being sent: ${JSON.stringify(Object.keys(formFields))}`,
      );

      const updatedDocGenFormFields = this.mapFormFieldsToDocGen(
        docGenFieldsResponse.docGenFormFields,
        formFields,
      );

      await this.client.updateEnvelopeDocGenFormFields(envelopeId, {
        docGenFormFields: updatedDocGenFormFields,
      });

      this.logger.log(`✓ Campos DocGen atualizados`);

      // ===== ETAPA 3: CRIAR SENDER VIEW =====
      this.logger.log('PREVIEW ETAPA 3: Criando Sender View...');

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

      // URL do Sender View expira em ~10 minutos
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      this.logger.log(`✓ Sender View criado`);
      this.logger.log(`=== PREVIEW PRONTO ===`);

      return {
        envelopeId,
        previewUrl: senderViewResponse.url,
        expiresAt,
      };
    } catch (error) {
      if (
        error instanceof EnvelopeEffectError ||
        error instanceof EnvelopeCreationAmbiguousError
      ) {
        throw error;
      }

      if (createdEnvelopeId) {
        throw new EnvelopeEffectError(
          createdEnvelopeId,
          'DRAFT_CONFIRMED',
          error,
        );
      }

      if (
        error instanceof ProviderUnavailableException ||
        error instanceof ProviderTimeoutException
      ) {
        this.logger.error('Erro de resiliência no preview');
        throw error;
      }

      if (error instanceof EnvelopeCreationFailedException) {
        this.logger.error(`Validação falhou no preview: ${error.message}`);
        throw error;
      }

      this.logger.error('Erro inesperado no preview');

      throw new EnvelopeCreationFailedException(
        'O provedor não concluiu a criação do preview.',
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

    let sendAttempted = false;
    try {
      const currentEnvelope = await this.client.getEnvelope(envelopeId);
      const currentStatus = currentEnvelope?.status as
        | EnvelopeStatus
        | undefined;

      if (
        currentStatus === EnvelopeStatus.SENT ||
        currentStatus === EnvelopeStatus.DELIVERED ||
        currentStatus === EnvelopeStatus.COMPLETED
      ) {
        this.logger.warn(
          `Envelope ${envelopeId} já está em status '${currentStatus}'. Tratando envio como idempotente.`,
        );

        return {
          envelopeId,
          status: currentStatus,
        };
      }

      sendAttempted = true;
      await this.client.updateEnvelopeStatus(envelopeId, 'sent');
      const statusAfterSend = await this.statusAfterSuccessfulSend(envelopeId);

      this.logger.log(`✓ Envelope ${envelopeId} enviado com sucesso`);

      return {
        envelopeId,
        status: statusAfterSend,
      };
    } catch (error) {
      if (error instanceof EnvelopeEffectError) throw error;
      if (!sendAttempted) {
        if (
          error instanceof ProviderUnavailableException ||
          error instanceof ProviderTimeoutException ||
          error instanceof EnvelopeCreationFailedException
        ) {
          throw error;
        }
        throw new EnvelopeCreationFailedException(
          'Não foi possível verificar o status do envelope antes do envio.',
        );
      }

      try {
        const envelopeAfterFailure = await this.client.getEnvelope(envelopeId);
        const statusAfterFailure = envelopeAfterFailure?.status as
          | EnvelopeStatus
          | undefined;

        if (
          statusAfterFailure === EnvelopeStatus.SENT ||
          statusAfterFailure === EnvelopeStatus.DELIVERED ||
          statusAfterFailure === EnvelopeStatus.COMPLETED
        ) {
          this.logger.warn(
            `Envelope ${envelopeId} retornou erro no update, mas já está '${statusAfterFailure}'. Prosseguindo como sucesso.`,
          );

          return {
            envelopeId,
            status: statusAfterFailure,
          };
        }

        if (statusAfterFailure !== EnvelopeStatus.CREATED) {
          throw new EnvelopeEffectError(
            envelopeId,
            'SEND_INDETERMINATE',
            error,
          );
        }
      } catch (statusCheckError) {
        if (statusCheckError instanceof EnvelopeEffectError) {
          throw statusCheckError;
        }
        this.logger.warn(
          'Não foi possível confirmar status do envelope após falha de envio',
        );
        throw new EnvelopeEffectError(envelopeId, 'SEND_INDETERMINATE', error);
      }

      this.logger.error('Erro ao enviar envelope draft');

      throw new EnvelopeEffectError(envelopeId, 'DRAFT_CONFIRMED', error);
    }
  }

  /**
   * Cancela (void) um envelope draft que não será enviado
   *
   * @param envelopeId - ID do envelope
   * @param reason - Motivo do cancelamento
   */
  async voidDraftEnvelope(envelopeId: string, reason: string): Promise<void> {
    this.logger.log(`Cancelando envelope draft ${envelopeId}`);

    try {
      await this.client.voidEnvelope(envelopeId, reason);
      this.logger.log(`✓ Envelope ${envelopeId} cancelado`);
    } catch (error) {
      this.logger.error('Erro ao cancelar envelope');
      throw error;
    }
  }

  /**
   * Mapeia os campos do formulário para a estrutura DocGen
   *
   * A API DocuSign retorna os campos com:
   * - 'label': nome limpo do campo (ex: "seller_cpf", "payment_seller_value_written")
   * - 'name': ID interno com prefixos/sufixos (ex: "/C_seller_cpf", "C_seller_name_value_Z157HB4")
   *
   * Usamos o 'label' como chave primária de lookup (sempre limpo).
   * Se 'label' não existir, normalizamos o 'name' como fallback.
   *
   * @param docGenFormFields - Array de documentos com campos DocGen da API
   * @param formFields - Mapa de campo -> valor do formulário
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
          // Prioridade: usar label (sempre limpo), fallback para name normalizado
          const fieldKey = field.label || field.name || '';
          const lookupKey = fieldKey.replace(/^\/?C_/, '');

          const value = formFields[lookupKey];

          if (value !== undefined) {
            this.logger.debug(`Mapeando campo DocGen: key="${lookupKey}"`);
            return {
              name: field.name,
              value: String(value),
            };
          } else {
            this.logger.warn(
              `Campo não encontrado: label="${field.label}", name="${field.name}", key="${lookupKey}"`,
            );
            return {
              name: field.name,
              value: field.value || '',
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

  /**
   * Lista os templates de envelope disponíveis na conta DocuSign
   *
   * @returns {Promise<Array<{ templateId: string; name: string }>>}
   */
  async listTemplates(): Promise<Array<{ templateId: string; name: string }>> {
    return this.client.listTemplates();
  }
}
