import { Injectable, Logger } from '@nestjs/common';
import { DocuSignService } from './docusign.service';
import { CreateEnvelopeDto } from './dto/envelope/create-envelope.dto';

@Injectable()
export class EnvelopeService {
  private readonly logger = new Logger(EnvelopeService.name);

  constructor(private readonly docusignService: DocuSignService) {}

  /** Criar envelope + salvar no banco */
  async createEnvelope(dto: CreateEnvelopeDto): Promise<any> {
    // TODO:
    // 1. Chamar docusignService.createEnvelope
    // 2. Salvar envelopeId e status no seu banco
    return {};
  }

  /** Gerar link de assinatura para o frontend */
  async generateSigningUrl(envelopeId: string, email: string, name: string): Promise<string> {
    // TODO: chamar serviço da DocuSign + registrar tentativa no banco
    return '';
  }

  /** Atualizar status no banco quando webhook chegar */
  async updateStatusFromWebhook(payload: any): Promise<void> {
    // TODO:
    // 1. Validar evento
    // 2. Atualizar registro no banco
    // 3. Disparar notificações internas (opcional)
  }

  /** Buscar envelope no banco */
  async getEnvelope(id: string): Promise<any> {
    // TODO: buscar no banco
    return {};
  }

  /** Sincronizar status com a DocuSign (caso webhook não funcione) */
  async syncEnvelope(envelopeId: string): Promise<void> {
    // TODO: usar docusignService.getEnvelopeStatus
  }
}
