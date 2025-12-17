import { Body, Controller, Post } from "@nestjs/common";
import { DocuSignClient } from "./docusign.client";
import { CreateEnvelopeDto } from "./dto/request/create-envelope.dto";

@Controller('test')
export class TestController {
  constructor(private readonly docuSignClient: DocuSignClient){}

  @Post('/envelope')
  async testCreateEnvelope(@Body() body: CreateEnvelopeDto) {
    return this.docuSignClient.createEnvelope(body);
  }

}
