// Classe para gerenciar o client da api do Docusign

import axios from 'axios';
import jwt from 'jsonwebtoken';

import { Injectable } from '@nestjs/common';

import { CreateEnvelopeDto } from './dto/request/create-envelope.dto';
import { CreateEnvelopeResponseDto } from './dto/response/create-envelope-response.dto';

@Injectable()
export class DocuSignClient {
  private readonly environment: 'demo' | 'prod';
  private readonly baseUrl: string;
  private privateKey: string;

  // Guardar o token em cache para evitar muitas chamadas para a API do docusign
  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

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
  }

  /**
   * Retorna a URL completa para a requisição, juntando baseUrl com o path relativo
   * @param {string} path - Caminho relativo da API (ex: /v2.1/accounts/{accountId}/envelopes)
   * @returns {string} URL completa
   */
  private getFullUrl(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  /**
   * Gerar o JWT e pegar o accessToken
   *
   * @returns {Promise<string>} - AcessToken obtido a partir do JWT
   */
  async getAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.cachedToken;
    }

    const aud =
      this.environment === 'prod'
        ? 'account.docusign.com'
        : 'account-d.docusign.com';

    // Organizar o payload
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.integrationKey, // Integration Key (Client ID)
      sub: this.userId, // User ID (Guid do usuário)
      aud,
      iat: now,
      exp: now + 60 * 60, // 1 hora de validade
    };

    // Gerar JWT assinado com a private key
    const token = jwt.sign(payload, this.privateKey, { algorithm: 'RS256' });

    // Trocar JWT por access_token
    const url = `https://${aud}/oauth/token`;
    const data = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: token,
    });

    try {
      const response = await axios.post(url, data.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const accessToken = response.data.access_token;
      const expiresIn = response.data.expires_in ?? 3600 // Pega o valor de expiração e caso não tenha nada, há um fallback para uma hora 

      // Guardar as informações em cahce
      this.cachedToken = accessToken;
      this.tokenExpiresAt = Date.now() + expiresIn * 1000;

      return accessToken;
    } catch (err) {
      throw new Error(
        `Erro ao gerar access token DocuSign: ${
          err?.response?.data
            ? JSON.stringify(err.response.data)
            : err?.message || String(err)
        }`,
      );
    }
  }

  /**
   * Realiza uma requisição POST para a DocuSign API
   * @param {string} url - Caminho relativo da API (ex: /v2.1/accounts/{accountId}/envelopes)
   * @param {any} body - Body que pode ser qualquer requisição de post para o DocuSign
   * @param {string} token - AccessToken JWT para autenticação
   * @returns {Promise<any>} Response da API DocuSign
   */
  private async post(url: string, body: any, token: string): Promise<any> {
    try {
      const response = await axios.post(this.getFullUrl(url), body, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });
      return response.data;
    } catch (err) {
      throw new Error(
        `Erro no método POST na DocuSign: ${
          err?.response?.data
            ? JSON.stringify(err.response.data)
            : err?.message || String(err)
        }`,
      );
    }
  }

  /**
   * Realiza uma requisição GET para a DocuSign API
   * @param {string} url - Caminho relativo da API (ex: /v2.1/accounts/{accountId}/envelopes/{envelopeId})
   * @param {string} token - AccessToken JWT para autenticação
   * @returns {Promise<any>} Response da API DocuSign
   */
  private async get(url: string, token: string): Promise<any> {
    try {
      const response = await axios.get(this.getFullUrl(url), {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });
      return response.data;
    } catch (err) {
      throw new Error(
        `Erro no método GET: ${
          err?.response?.data
            ? JSON.stringify(err.response.data)
            : err?.message || String(err)
        }`,
      );
    }
  }

  /**
   * Criar o envelope no DocuSign a partir do token obtido
   *
   * @param {CreateEnvelopeDto} createEnvelopeDto - Dto para criar o envelope na docusign
   * @returns {Promise<CreateEnvelopeResponseDto>} - Response do envelope criado pela docusign
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
   *
   * @param {CreateEnvelopeDtostring} envelopeId - Id do envelope na Docusign
   * @returns {Promise<CreateEnvelopeDto>} - Response do envelope no Docusign
   */
  async getEnvelope(envelopeId: string): Promise<CreateEnvelopeResponseDto> {
    const token = await this.getAccessToken();
    return this.get(
      `/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}`,
      token,
    );
  }
}
