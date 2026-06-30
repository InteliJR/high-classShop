import { Body, Controller, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { DocuSignClient } from './docusign.client';
import { CreateEnvelopeDto } from './dto/request/create-envelope.dto';
import { Roles } from 'src/shared/decorators/roles.decorator';

// Controlador de teste: cria envelopes DocuSign reais. Restrito ao ADMIN.
// TODO: remover de builds de produção.
@Controller('test')
@Roles(UserRole.ADMIN)
export class TestController {
  constructor(private readonly docuSignClient: DocuSignClient) {}

  @Post('/envelope')
  async testCreateEnvelope(@Body() body: CreateEnvelopeDto) {
    return this.docuSignClient.createEnvelope(body);
  }
}
