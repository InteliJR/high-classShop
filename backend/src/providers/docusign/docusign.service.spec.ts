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
    transactionId: '11111111-1111-4111-8111-111111111111',
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
      getEnvelope: jest.fn().mockResolvedValue({
        envelopeId: 'envelope-1',
        status: 'sent',
      }),
    } as any;
    const service = new DocuSignService(client);

    await service.createEnvelopeFromTemplate(templateParams);

    expect(client.createEnvelopeFromTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: templateParams.transactionId }),
    );
  });

  it('recupera o envelope pelo transactionId quando o POST foi aplicado mas todas as respostas se perderam', async () => {
    const postFailure = new Error('all POST responses lost');
    const client: any = {
      findEnvelopesByTransactionId: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { envelopeId: 'envelope-recovered', status: 'created' },
        ]),
      createEnvelopeFromTemplate: jest.fn().mockRejectedValue(postFailure),
      getEnvelopeWithCustomFields: jest.fn().mockImplementation(async () => ({
        customFields:
          client.createEnvelopeFromTemplate.mock.calls[0][0].customFields,
      })),
      getEnvelopeDocGenFormFields: jest.fn().mockResolvedValue({
        docGenFormFields: [],
      }),
      updateEnvelopeDocGenFormFields: jest.fn().mockResolvedValue(undefined),
      updateEnvelopeStatus: jest.fn().mockResolvedValue(undefined),
      getEnvelope: jest.fn().mockResolvedValue({
        envelopeId: 'envelope-recovered',
        status: 'sent',
      }),
    } as any;
    const service = new DocuSignService(client);
    const onEnvelopeCreated = jest.fn();

    await expect(
      service.createEnvelopeFromTemplate({
        ...templateParams,
        onEnvelopeCreated,
      }),
    ).resolves.toEqual({
      envelopeId: 'envelope-recovered',
      status: 'sent',
    });
    expect(client.createEnvelopeFromTemplate).toHaveBeenCalledTimes(1);
    expect(client.findEnvelopesByTransactionId).toHaveBeenCalledTimes(2);
    expect(onEnvelopeCreated).toHaveBeenCalledWith('envelope-recovered');
  });

  it('rejects a recovered envelope that belongs to another process', async () => {
    const client = {
      findEnvelopesByTransactionId: jest
        .fn()
        .mockResolvedValue([
          { envelopeId: 'foreign-envelope', status: 'created' },
        ]),
      getEnvelopeWithCustomFields: jest.fn().mockResolvedValue({
        customFields: {
          textCustomFields: [
            { name: 'processId', value: 'process-2' },
            { name: 'requestFingerprint', value: 'foreign-fingerprint' },
          ],
        },
      }),
      createEnvelopeFromTemplate: jest.fn(),
    } as any;
    const service = new DocuSignService(client);

    await expect(
      service.createEnvelopeFromTemplate(templateParams),
    ).rejects.toMatchObject({
      name: 'EnvelopeCreationAmbiguousError',
      transactionId: templateParams.transactionId,
    });
    expect(client.createEnvelopeFromTemplate).not.toHaveBeenCalled();
  });

  it('rejects a recovered envelope when the immutable request payload changed', async () => {
    const client = {
      findEnvelopesByTransactionId: jest
        .fn()
        .mockResolvedValue([
          { envelopeId: 'stale-envelope', status: 'created' },
        ]),
      getEnvelopeWithCustomFields: jest.fn().mockResolvedValue({
        customFields: {
          textCustomFields: [
            { name: 'processId', value: 'process-1' },
            { name: 'requestFingerprint', value: 'stale-fingerprint' },
          ],
        },
      }),
      createEnvelopeFromTemplate: jest.fn(),
    } as any;
    const service = new DocuSignService(client);

    await expect(
      service.createEnvelopeFromTemplate(templateParams),
    ).rejects.toMatchObject({ name: 'EnvelopeCreationAmbiguousError' });
    expect(client.createEnvelopeFromTemplate).not.toHaveBeenCalled();
  });

  it('does not classify a definitive provider 4xx as ambiguous when no envelope exists', async () => {
    const providerFailure = Object.assign(new Error('invalid recipients'), {
      isAxiosError: true,
      response: { status: 400 },
    });
    const client = {
      findEnvelopesByTransactionId: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
      createEnvelopeFromTemplate: jest.fn().mockRejectedValue(providerFailure),
    } as any;
    const service = new DocuSignService(client);

    await expect(
      service.createEnvelopeFromTemplate(templateParams),
    ).rejects.toMatchObject({ name: 'EnvelopeCreationFailedException' });
  });

  it('reusa um envelope recuperado em nova chamada e não repete o POST', async () => {
    const client: any = {
      findEnvelopesByTransactionId: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { envelopeId: 'envelope-existing', status: 'sent' },
        ]),
      createEnvelopeFromTemplate: jest.fn().mockResolvedValue({
        envelopeId: 'envelope-existing',
        status: 'sent',
      }),
      getEnvelopeWithCustomFields: jest.fn().mockImplementation(async () => ({
        customFields:
          client.createEnvelopeFromTemplate.mock.calls[0][0].customFields,
      })),
    };
    const service = new DocuSignService(client);

    await service.createEnvelopeFromTemplate(templateParams);
    await expect(
      service.createEnvelopeFromTemplate(templateParams),
    ).resolves.toEqual({ envelopeId: 'envelope-existing', status: 'sent' });
    expect(client.createEnvelopeFromTemplate).toHaveBeenCalledTimes(1);
  });

  it.each(['voided', 'declined'])(
    'never edits a recovered envelope in terminal status %s',
    async (status) => {
      const client: any = {
        findEnvelopesByTransactionId: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            { envelopeId: 'terminal-envelope', status },
          ]),
        createEnvelopeFromTemplate: jest.fn().mockResolvedValue({
          envelopeId: 'terminal-envelope',
          status: 'sent',
        }),
        getEnvelopeWithCustomFields: jest
          .fn()
          .mockImplementation(async () => ({
            customFields:
              client.createEnvelopeFromTemplate.mock.calls[0][0].customFields,
          })),
        getEnvelopeDocGenFormFields: jest.fn(),
      };
      const service = new DocuSignService(client);
      await service.createEnvelopeFromTemplate(templateParams);

      await expect(
        service.createEnvelopeFromTemplate(templateParams),
      ).rejects.toMatchObject({ name: 'EnvelopeCreationAmbiguousError' });
      expect(client.getEnvelopeDocGenFormFields).not.toHaveBeenCalled();
    },
  );

  it('classifica como ambígua a criação quando a recuperação após perda do POST não é conclusiva', async () => {
    const postFailure = new Error('all POST responses lost');
    const recoveryFailure = new Error('recovery unavailable');
    const client = {
      findEnvelopesByTransactionId: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(recoveryFailure),
      createEnvelopeFromTemplate: jest.fn().mockRejectedValue(postFailure),
    } as any;
    const service = new DocuSignService(client);

    await expect(
      service.createEnvelopeFromTemplate(templateParams),
    ).rejects.toMatchObject({
      name: 'EnvelopeCreationAmbiguousError',
      transactionId: templateParams.transactionId,
      cause: postFailure,
    });
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

  it.each(['delivered', 'completed'] as const)(
    'preserva o status avançado %s ao recuperar um envio já aplicado',
    async (status) => {
      const client = {
        getEnvelope: jest.fn().mockResolvedValue({ status }),
        updateEnvelopeStatus: jest.fn(),
      } as any;
      const service = new DocuSignService(client);

      await expect(service.sendDraftEnvelope('envelope-1')).resolves.toEqual({
        envelopeId: 'envelope-1',
        status,
      });
      expect(client.updateEnvelopeStatus).not.toHaveBeenCalled();
    },
  );

  it('returns the actual provider status after a successful send PUT', async () => {
    const client = {
      getEnvelope: jest
        .fn()
        .mockResolvedValueOnce({ status: 'created' })
        .mockResolvedValueOnce({ status: 'delivered' }),
      updateEnvelopeStatus: jest.fn().mockResolvedValue(undefined),
    } as any;
    const service = new DocuSignService(client);

    await expect(service.sendDraftEnvelope('envelope-1')).resolves.toEqual({
      envelopeId: 'envelope-1',
      status: 'delivered',
    });
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

  it('não registra valores de CPF, RG, endereço ou dados bancários ao mapear DocGen', () => {
    const sensitiveValues = [
      '12345678901',
      'RG-SECRET',
      'Rua Sigilosa 42',
      'BANK-SECRET',
    ];
    const debug = jest
      .spyOn((service as any).logger, 'debug')
      .mockImplementation();
    const warn = jest
      .spyOn((service as any).logger, 'warn')
      .mockImplementation();
    const fields = sensitiveValues.map((value, index) => ({
      name: `field_${index}`,
      label: `field_${index}`,
      value: '',
    }));

    (service as any).mapFormFieldsToDocGen(
      [{ documentId: '1', docGenFormFieldList: fields }],
      Object.fromEntries(
        sensitiveValues.map((value, index) => [`field_${index}`, value]),
      ),
    );

    const logs = JSON.stringify([...debug.mock.calls, ...warn.mock.calls]);
    for (const value of sensitiveValues) expect(logs).not.toContain(value);
  });
});
