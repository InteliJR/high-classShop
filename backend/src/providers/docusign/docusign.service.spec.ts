import { DocuSignService } from './docusign.service';

describe('DocuSignService — listTemplates', () => {
  it('mapeia envelopeTemplates do client para {templateId, name}', async () => {
    const client = {
      listTemplates: jest.fn().mockResolvedValue([
        { templateId: 'a', name: 'Contrato de Carro' },
        { templateId: 'b', name: 'Contrato de Aeronave' },
      ]),
    } as any;
    const service = new DocuSignService(client);

    const result = await service.listTemplates();

    expect(client.listTemplates).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      { templateId: 'a', name: 'Contrato de Carro' },
      { templateId: 'b', name: 'Contrato de Aeronave' },
    ]);
  });
});

describe('DocuSignService — vínculo do envelope ao processo', () => {
  it('reads the processId custom field from an envelope', async () => {
    const client = {
      getEnvelopeWithCustomFields: jest.fn().mockResolvedValue({
        customFields: {
          textCustomFields: [{ name: 'processId', value: 'process-1' }],
        },
      }),
    } as any;
    const service = new DocuSignService(client);

    await expect(service.getEnvelopeProcessId('envelope-1')).resolves.toBe(
      'process-1',
    );
  });
});

describe('DocuSignService — cancelamento de envelope', () => {
  it('propaga falha do provedor ao cancelar um draft', async () => {
    const providerFailure = new Error('void rejected by provider');
    const client = {
      voidEnvelope: jest.fn().mockRejectedValue(providerFailure),
    } as any;
    const service = new DocuSignService(client);

    await expect(
      service.voidDraftEnvelope('envelope-1', 'Cancelamento explícito'),
    ).rejects.toBe(providerFailure);
  });
});

describe('DocuSignService — efeitos externos parciais', () => {
  const templateParams = {
    templateId: 'template-1',
    buyerEmail: 'buyer@example.test',
    buyerName: 'Buyer',
    sellerEmail: 'seller@example.test',
    sellerName: 'Seller',
    formFields: {},
    processId: 'process-1',
  };

  it('registra o draft imediatamente e preserva metadados seguros se o DocGen falhar', async () => {
    const providerFailure = new Error('raw provider docgen failure');
    const client = {
      createEnvelopeFromTemplate: jest.fn().mockResolvedValue({
        envelopeId: 'envelope-partial',
        status: 'created',
      }),
      getEnvelopeDocGenFormFields: jest.fn().mockRejectedValue(providerFailure),
    } as any;
    const service = new DocuSignService(client);
    const onEnvelopeCreated = jest.fn();

    await expect(
      service.createEnvelopeFromTemplate({
        ...templateParams,
        onEnvelopeCreated,
      }),
    ).rejects.toMatchObject({
      envelopeId: 'envelope-partial',
      effectState: 'DRAFT_CONFIRMED',
      cause: providerFailure,
    });
    expect(onEnvelopeCreated).toHaveBeenCalledWith('envelope-partial');
  });

  it('usa uma chave idempotente por operação ao criar o envelope', async () => {
    const client = {
      createEnvelopeFromTemplate: jest.fn().mockResolvedValue({
        envelopeId: 'envelope-1',
        status: 'created',
      }),
      getEnvelopeDocGenFormFields: jest.fn().mockResolvedValue({
        docGenFormFields: [],
      }),
      updateEnvelopeDocGenFormFields: jest.fn().mockResolvedValue(undefined),
      updateEnvelopeStatus: jest.fn().mockResolvedValue(undefined),
    } as any;
    const service = new DocuSignService(client);

    await service.createEnvelopeFromTemplate(templateParams);

    expect(client.createEnvelopeFromTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: expect.any(String) }),
    );
  });

  it('classifica envio como indeterminado quando a confirmação de status também falha', async () => {
    const sendFailure = new Error('raw provider send failure');
    const statusFailure = new Error('raw provider status failure');
    const client = {
      getEnvelope: jest
        .fn()
        .mockResolvedValueOnce({ status: 'created' })
        .mockRejectedValueOnce(statusFailure),
      updateEnvelopeStatus: jest.fn().mockRejectedValue(sendFailure),
    } as any;
    const service = new DocuSignService(client);

    await expect(service.sendDraftEnvelope('envelope-1')).rejects.toMatchObject(
      {
        envelopeId: 'envelope-1',
        effectState: 'SEND_INDETERMINATE',
        cause: sendFailure,
      },
    );
  });
});

describe('DocuSignService — mapFormFieldsToDocGen é removal-safe', () => {
  const service = new DocuSignService({} as any);

  it('template sem campos de comissão não recebe nenhum campo de comissão e não lança', () => {
    // template só tem buyer_name (comissão foi apagada do Template.docx)
    const templateDocs = [
      {
        documentId: '1',
        docGenFormFieldList: [
          { name: 'buyer_name', label: 'buyer_name', value: '' },
        ],
      },
    ];
    const formFields = {
      buyer_name: 'Comprador',
      platform_value: 'R$ 0,00', // chave extra: NÃO existe no template
      specialist_value: 'R$ 0,00',
    };

    const result = (service as any).mapFormFieldsToDocGen(
      templateDocs,
      formFields,
    );
    const names = result[0].docGenFormFieldList.map((f: any) => f.name);

    expect(names).toEqual(['buyer_name']); // só o que o template pediu
    expect(names).not.toContain('platform_value');
    expect(names).not.toContain('specialist_value');
    expect(result[0].docGenFormFieldList[0].value).toBe('Comprador');
  });
});
