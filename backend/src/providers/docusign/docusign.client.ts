// Classe para gerenciar o client da api do Docusign

import axios, { AxiosError } from 'axios';
import jwt from 'jsonwebtoken';

import { Injectable, Logger } from '@nestjs/common';

import { CreateEnvelopeDto } from './dto/request/create-envelope.dto';
import { CreateTemplateEnvelopeDto } from './dto/request/create-template-envelope.dto';
import { CreateEnvelopeResponseDto } from './dto/response/create-envelope-response.dto';
import {
  ProviderUnavailableException,
  ProviderTimeoutException,
} from 'src/shared/exceptions/custom-exceptions';

/**
 * DocuSignClient - Cliente HTTP para API da DocuSign
 *
 * Responsabilidades:
 * - Gerenciar autenticação JWT Grant
 * - Cache de access tokens (evita múltiplas chamadas)
 * - Resiliência: retry, timeout, tratamento de erros
 * - Logging detalhado para debugging
 *
 * Segurança:
 * - Private key armazenada em memória (não em logs)
 * - Tokens com expiração
 * - Não exponha stack traces de erro para cliente
 */
@Injectable()
export class DocuSignClient {
  private readonly logger = new Logger(DocuSignClient.name);

  private readonly environment: 'demo' | 'prod';
  private readonly baseUrl: string;
  private privateKey: string;

  // Cache de token para evitar múltiplas chamadas de autenticação
  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

  // Configurações de resiliência
  private readonly REQUEST_TIMEOUT_MS = 30000; // 30 segundos
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 1000; // 1 segundo entre tentativas

  constructor(
    private readonly integrationKey: string,
    private readonly userId: string,
    private readonly accountId: string,
    privateKey: string,
    environment: 'demo' | 'prod' = 'demo',
  ) {
    this.privateKey = privateKey.replace(/\\n/g, '\n');
    this.environment = environment;
    this.baseUrl =
      environment === 'prod'
        ? 'https://www.docusign.net/restapi'
        : 'https://demo.docusign.net/restapi';

    this.logger.log(`DocuSignClient inicializado (${environment})`);
  }

  /**
   * Retorna a URL completa para a requisição
   * @param {string} path - Caminho relativo da API
   * @returns {string} URL completa
   */
  private getFullUrl(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  /**
   * Gera JWT e obtém access token via JWT Grant
   *
   * Fluxo:
   * 1. Verificar se token em cache ainda é válido
   * 2. Se válido, retornar token em cache
   * 3. Se expirado, gerar novo JWT
   * 4. Trocar JWT por access_token na API de OAuth
   * 5. Armazenar em cache com data de expiração
   *
   * @returns {Promise<string>} Access token para autenticação
   * @throws ProviderUnavailableException - Se OAuth falhar
   */
  async getAccessToken(): Promise<string> {
    // ✅ Verificar cache: token ainda é válido?
    // Renova 60 segundos antes da expiração (margem de segurança)
    if (this.cachedToken && Date.now() < this.tokenExpiresAt - 60000) {
      this.logger.debug(`Token em cache utilizado`);
      return this.cachedToken;
    }

    this.logger.log(`Gerando novo access token JWT...`);

    const aud =
      this.environment === 'prod'
        ? 'account.docusign.com'
        : 'account-d.docusign.com';

    // Montar payload do JWT
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.integrationKey, // Integration Key (Client ID)
      sub: this.userId, // User ID
      aud,
      iat: now,
      exp: now + 60 * 60, // 1 hora de validade
      scope: 'signature impersonation',
    };

    // Assinar JWT com private key
    const token = jwt.sign(payload, this.privateKey, { algorithm: 'RS256' });

    // Trocar JWT por access_token no endpoint de OAuth
    const oauthUrl = `https://${aud}/oauth/token`;
    const data = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: token,
    });

    try {
      const response = await axios.post(oauthUrl, data.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: this.REQUEST_TIMEOUT_MS,
      });

      const accessToken = response.data.access_token;
      const expiresIn = response.data.expires_in ?? 3600; // fallback: 1 hora

      // Armazenar em cache
      this.cachedToken = accessToken;
      this.tokenExpiresAt = Date.now() + expiresIn * 1000;

      this.logger.log(`Token obtido com sucesso (expira em ${expiresIn}s)`);

      return accessToken;
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      this.logger.error(
        `Falha ao obter access token na OAuth: ${errorMessage}`,
      );

      // Verificar tipo de erro
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new ProviderTimeoutException(
            'DocuSign OAuth',
            this.REQUEST_TIMEOUT_MS,
          );
        }

        if (error.response?.status === 401 || error.response?.status === 403) {
          // Credentials inválidas - erro de configuração
          throw new ProviderUnavailableException(
            'DocuSign',
            'Credenciais inválidas (Integration Key ou Private Key incorretos)',
          );
        }

        if ((error.response?.status ?? 0) >= 500) {
          throw new ProviderUnavailableException('DocuSign', errorMessage);
        }
      }

      throw new ProviderUnavailableException('DocuSign', errorMessage);
    }
  }

  /**
   * Realiza requisição POST com retry automático
   *
   * Resiliência:
   * - Retry automático em falhas de rede
   * - Timeout de 30 segundos
   * - Tratamento específico para cada tipo de erro
   *
   * @param {string} url - Caminho relativo da API
   * @param {any} body - Body da requisição
   * @param {string} token - Access token
   * @returns {Promise<any>} Response da API
   */
  private async post(url: string, body: any, token: string): Promise<any> {
    // Log detalhado do payload para debug
    this.logger.debug(`[POST] Payload being sent to DocuSign:`);
    this.logger.debug(JSON.stringify(body, null, 2));

    return this.makeRequest(
      async () => {
        const response = await axios.post(this.getFullUrl(url), body, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          timeout: this.REQUEST_TIMEOUT_MS,
        });
        return response.data;
      },
      'POST',
      url,
    );
  }

  /**
   * Realiza requisição GET com retry automático
   *
   * @param {string} url - Caminho relativo da API
   * @param {string} token - Access token
   * @returns {Promise<any>} Response da API
   */
  private async get(url: string, token: string): Promise<any> {
    return this.makeRequest(
      async () => {
        const response = await axios.get(this.getFullUrl(url), {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          timeout: this.REQUEST_TIMEOUT_MS,
        });
        return response.data;
      },
      'GET',
      url,
    );
  }

  /**
   * Wrapper de requisição com retry e tratamento de erro
   *
   * @param requestFn - Função que executa a requisição
   * @param method - GET/POST (para logging)
   * @param url - URL (para logging)
   * @returns Response da API
   */
  private async makeRequest<T>(
    requestFn: () => Promise<T>,
    method: string,
    url: string,
  ): Promise<T> {
    let lastError: Error | null = null;

    // Tentar até MAX_RETRIES vezes
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        this.logger.debug(
          `[${method}] ${url} (tentativa ${attempt}/${this.MAX_RETRIES})`,
        );
        const result = await requestFn();
        return result;
      } catch (error) {
        lastError = error as Error;

        // Verificar se é erro recuperável
        const isRecoverable = this.isRecoverableError(error);

        if (!isRecoverable || attempt === this.MAX_RETRIES) {
          // Erro não recuperável ou última tentativa
          throw error;
        }

        // Aguardar antes de retry (exponential backoff)
        const delayMs = this.RETRY_DELAY_MS * attempt;
        this.logger.warn(
          `[${method}] ${url} falhou (${lastError.message}). Retry em ${delayMs}ms...`,
        );
        await this.delay(delayMs);
      }
    }

    // Não deveria chegar aqui, mas por segurança
    throw lastError || new Error('Erro desconhecido na requisição');
  }

  /**
   * Verifica se é um erro recuperável (vale a pena fazer retry)
   */
  private isRecoverableError(error: any): boolean {
    if (!axios.isAxiosError(error)) {
      return false;
    }

    // Erros de rede são recuperáveis
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return true;
    }

    // Timeouts são recuperáveis
    if (error.code === 'ECONNABORTED') {
      return true;
    }

    // 5xx são recuperáveis
    if (error.response?.status && error.response.status >= 500) {
      return true;
    }

    // 429 (rate limit) é recuperável
    if (error.response?.status === 429) {
      return true;
    }

    return false;
  }

  /**
   * Extrai mensagem de erro humanizada
   */
  private extractErrorMessage(error: any): string {
    if (axios.isAxiosError(error)) {
      // Tentar extrair mensagem da response
      if (error.response?.data?.message) {
        return error.response.data.message;
      }

      if (error.response?.data?.errorCode) {
        return `${error.response.data.errorCode}: ${error.response.data.message || 'Erro na API DocuSign'}`;
      }

      if (typeof error.response?.data === 'string') {
        return error.response.data;
      }

      if (error.code === 'ECONNABORTED') {
        return 'Timeout na conexão com DocuSign';
      }

      if (error.code === 'ECONNREFUSED') {
        return 'DocuSign está indisponível';
      }

      return error.message || 'Erro desconhecido na API';
    }

    return error instanceof Error ? error.message : String(error);
  }

  /**
   * Delay helper (para retry com backoff)
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Cria um envelope na DocuSign
   *
   * @param {CreateEnvelopeDto} createEnvelopeDto - DTO com dados do envelope
   * @returns {Promise<CreateEnvelopeResponseDto>} Response com ID do envelope
   * @throws ProviderUnavailableException - Se DocuSign está indisponível
   * @throws ProviderTimeoutException - Se timeout na requisição
   */
  async createEnvelope(
    createEnvelopeDto: CreateEnvelopeDto,
  ): Promise<CreateEnvelopeResponseDto> {
    const token = await this.getAccessToken();
    return this.post(
      `/v2.1/accounts/${this.accountId}/envelopes`,
      createEnvelopeDto,
      token,
    );
  }

  /**
   * Obtém status de um envelope
   *
   * @param {string} envelopeId - ID do envelope
   * @returns {Promise<CreateEnvelopeResponseDto>} Dados do envelope
   */
  async getEnvelope(envelopeId: string): Promise<CreateEnvelopeResponseDto> {
    const token = await this.getAccessToken();
    return this.get(
      `/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}`,
      token,
    );
  }

  /**
   * Cria um envelope a partir de um template DocuSign
   *
   * Usado para contratos baseados em formulário onde os campos
   * são pré-preenchidos via textTabs nos templateRoles.
   *
   * @param {CreateTemplateEnvelopeDto} dto - DTO com template ID, roles e tabs
   * @returns {Promise<CreateEnvelopeResponseDto>} Response com ID do envelope
   * @throws ProviderUnavailableException - Se DocuSign está indisponível
   * @throws ProviderTimeoutException - Se timeout na requisição
   */
  async createEnvelopeFromTemplate(
    dto: CreateTemplateEnvelopeDto,
  ): Promise<CreateEnvelopeResponseDto> {
    const token = await this.getAccessToken();
    return this.post(`/v2.1/accounts/${this.accountId}/envelopes`, dto, token);
  }

  /**
   * Realiza requisição PUT com retry automático
   *
   * @param {string} url - Caminho relativo da API
   * @param {any} body - Body da requisição
   * @param {string} token - Access token
   * @returns {Promise<any>} Response da API
   */
  private async put(url: string, body: any, token: string): Promise<any> {
    // Log detalhado do payload para debug
    this.logger.debug(`[PUT] Payload being sent to DocuSign:`);
    this.logger.debug(JSON.stringify(body, null, 2));

    return this.makeRequest(
      async () => {
        const response = await axios.put(this.getFullUrl(url), body, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          timeout: this.REQUEST_TIMEOUT_MS,
        });
        return response.data;
      },
      'PUT',
      url,
    );
  }

  /**
   * Obtém os campos DocGen de um envelope
   *
   * Usado para templates DocGen (AceGen) onde os campos são preenchidos
   * via fluxo assíncrono de 4 etapas.
   *
   * @param {string} envelopeId - ID do envelope
   * @returns {Promise<any>} Lista de documentos com campos DocGen
   */
  async getEnvelopeDocGenFormFields(envelopeId: string): Promise<any> {
    const token = await this.getAccessToken();
    this.logger.log(`Getting DocGen form fields for envelope ${envelopeId}`);
    return this.get(
      `/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}/docGenFormFields`,
      token,
    );
  }

  /**
   * Atualiza os campos DocGen de um envelope
   *
   * Usado para templates DocGen (AceGen) onde os campos são preenchidos
   * via fluxo assíncrono de 4 etapas.
   *
   * @param {string} envelopeId - ID do envelope
   * @param {any} docGenFormFields - Campos DocGen para atualizar
   * @returns {Promise<any>} Response da API
   */
  async updateEnvelopeDocGenFormFields(
    envelopeId: string,
    docGenFormFields: any,
  ): Promise<any> {
    const token = await this.getAccessToken();
    this.logger.log(`Updating DocGen form fields for envelope ${envelopeId}`);
    return this.put(
      `/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}/docGenFormFields`,
      docGenFormFields,
      token,
    );
  }

  /**
   * Atualiza o status de um envelope (ex: de 'created' para 'sent')
   *
   * Usado no fluxo DocGen para enviar o envelope após preencher os campos.
   *
   * @param {string} envelopeId - ID do envelope
   * @param {string} status - Novo status ('sent', 'voided', etc)
   * @param {string} voidedReason - Motivo de cancelamento (se status = 'voided')
   * @returns {Promise<any>} Response da API
   */
  async updateEnvelopeStatus(
    envelopeId: string,
    status: string,
    voidedReason?: string,
  ): Promise<any> {
    const token = await this.getAccessToken();
    this.logger.log(`Updating envelope ${envelopeId} status to ${status}`);

    const body: any = { status };
    if (voidedReason && status === 'voided') {
      body.voidedReason = voidedReason;
    }

    return this.put(
      `/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}`,
      body,
      token,
    );
  }

  /**
   * Cria uma URL de Sender View para pré-visualização do envelope
   *
   * O Sender View permite ao usuário visualizar e editar o envelope
   * antes de enviá-lo. A URL retornada expira em 10 minutos.
   *
   * Requisitos:
   * - O envelope deve estar em status 'created' (draft)
   * - viewAccess deve ser 'envelope'
   *
   * Eventos de retorno possíveis (via query param na returnUrl):
   * - send: usuário enviou o envelope
   * - save: usuário salvou o envelope
   * - cancel: usuário cancelou
   * - error: erro durante a operação
   * - sessionEnd: sessão expirou
   *
   * @param {string} envelopeId - ID do envelope em modo draft
   * @param {string} returnUrl - URL de callback após ação do usuário
   * @param {object} settings - Configurações de UI do Sender View
   * @returns {Promise<{ url: string }>} URL do Sender View para embed
   * @throws ProviderUnavailableException - Se DocuSign está indisponível
   * @throws ProviderTimeoutException - Se timeout na requisição
   */
  async createSenderView(
    envelopeId: string,
    returnUrl: string,
    settings?: {
      startingScreen?: 'Prepare' | 'Tagger';
      showBackButton?: 'true' | 'false';
      showEditRecipients?: 'true' | 'false';
      showEditDocuments?: 'true' | 'false';
      showDiscardAction?: 'true' | 'false';
      sendButtonAction?: 'send' | 'redirect';
    },
  ): Promise<{ url: string }> {
    const token = await this.getAccessToken();

    this.logger.log(`Creating Sender View for envelope ${envelopeId}`);

    // Configurações padrão para o Sender View
    // IMPORTANTE: sendButtonAction='redirect' impede o envio direto pelo DocuSign
    // O usuário deve confirmar o envio pelo nosso sistema
    const defaultSettings = {
      startingScreen: 'Tagger',
      showBackButton: 'false',
      showEditRecipients: 'false',
      showEditDocuments: 'false',
      showDiscardAction: 'false',
      sendButtonAction: 'redirect', // Muda botão para "Continuar" em vez de "Enviar"
    };

    const viewSettings = { ...defaultSettings, ...settings };

    const requestBody = {
      returnUrl,
      viewAccess: 'envelope',
      locale: 'pt_BR',
      settings: {
        startingScreen: viewSettings.startingScreen,
        showBackButton: viewSettings.showBackButton,
        showHeaderActions: 'false', // Esconde menu avançado (editar mensagem, docs, etc)
        showDiscardAction: viewSettings.showDiscardAction,
        sendButtonAction: viewSettings.sendButtonAction,
        recipientSettings: {
          showEditRecipients: viewSettings.showEditRecipients,
          showContactsList: 'false',
        },
        documentSettings: {
          showEditDocuments: viewSettings.showEditDocuments,
          showEditPages: 'false', // Impede deletar/rotacionar páginas
          showEditDocumentVisibility: 'false',
        },
        templateSettings: {
          showMatchingTemplatesPrompt: 'false', // Esconde diálogo de template matching
        },
        // IMPORTANTE: Esconde a tela de edição de campos do remetente (seller_name, seller_cpf, etc)
        // Isso impede que o usuário altere dados sensíveis pré-preenchidos
        prefillSettings: {
          showPrefillTags: 'false', // Esconde a edição de sender field data
        },
        taggerSettings: {
          showTagLibrary: 'false', // Esconde biblioteca de tags
          showTagBulkSend: 'false', // Esconde envio em massa
        },
      },
    };

    this.logger.debug(`Sender View request body: ${JSON.stringify(requestBody, null, 2)}`);

    return this.post(
      `/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}/views/sender`,
      requestBody,
      token,
    );
  }

  /**
   * Baixa o documento combinado do envelope como PDF
   *
   * Retorna o PDF como base64 para ser exibido diretamente no frontend,
   * evitando a necessidade de usar o Sender View do DocuSign.
   *
   * @param {string} envelopeId - ID do envelope
   * @returns {Promise<{ pdfBase64: string }>} PDF em formato base64
   * @throws ProviderUnavailableException - Se DocuSign está indisponível
   */
  async getCombinedDocument(envelopeId: string): Promise<{ pdfBase64: string }> {
    const token = await this.getAccessToken();

    this.logger.log(`Downloading combined document for envelope ${envelopeId}`);

    const url = this.getFullUrl(
      `/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}/documents/combined`,
    );

    const response = await this.makeRequest(
      async () => {
        return axios.get(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          responseType: 'arraybuffer',
          timeout: this.REQUEST_TIMEOUT_MS,
        });
      },
      'getCombinedDocument',
      url,
    );

    // Converter ArrayBuffer para base64
    const pdfBase64 = Buffer.from(response.data).toString('base64');

    this.logger.log(`Combined document downloaded (${pdfBase64.length} chars base64)`);

    return { pdfBase64 };
  }

  /**
   * Exclui um envelope em modo draft
   *
   * Usado para limpar envelopes de preview que foram cancelados.
   * Só pode excluir envelopes em status 'created' (draft).
   *
   * @param {string} envelopeId - ID do envelope
   * @returns {Promise<void>}
   */
  async voidEnvelope(envelopeId: string, reason: string): Promise<any> {
    this.logger.log(`Voiding envelope ${envelopeId}: ${reason}`);
    return this.updateEnvelopeStatus(envelopeId, 'voided', reason);
  }
}