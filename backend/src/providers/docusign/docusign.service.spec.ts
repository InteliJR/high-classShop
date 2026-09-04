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
