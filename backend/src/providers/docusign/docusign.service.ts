import { Injectable, Logger } from '@nestjs/common';
import { DocuSignClient } from './docusign.client';
import { CreateEnvelopeDto } from './dto/envelope/create-envelope.dto';

@Injectable()
export class DocuSignService {
  private readonly logger = new Logger(DocuSignService.name);

  constructor(private readonly client: DocuSignClient) {}

  /** Autenticação / Refresh token */
  async getAccessToken(): Promise<string> {
    // TODO: chamar client e armazenar token
    return '';
  }

  /** Criar envelope na DocuSign */
  async createEnvelope(dto: CreateEnvelopeDto): Promise<{ envelopeId: string }> {
    // TODO: montar payload + enviar para DocuSign
    return { envelopeId: '' };
  }

  /** Gerar URL para assinatura (Recipient View) */
  async createRecipientView(envelopeId: string, recipientEmail: string, recipientName: string): Promise<string> {
    // TODO: chamar API para gerar link
    return '';
  }

  /** Consultar status de um envelope */
  async getEnvelopeStatus(envelopeId: string): Promise<any> {
    // TODO: GET /envelopes/{id}
    return {};
  }

  /** Baixar documentos do envelope */
  async getEnvelopeDocuments(envelopeId: string): Promise<any> {
    // TODO: GET /envelopes/{id}/documents
    return {};
  }

  /** Cancelar / void envelope */
  async voidEnvelope(envelopeId: string): Promise<void> {
    // TODO: PUT void envelope
  }
}
