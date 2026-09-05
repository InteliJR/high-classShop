import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PreviewContractDto } from './preview-contract.dto';
import { GenerateContractDto } from './generate-contract.dto';

const processId = '550e8400-e29b-41d4-a716-446655440000';
const operationId = '11111111-1111-4111-8111-111111111111';

/** Só o que continua estruturalmente obrigatório. */
const minimoPreview = {
  operation_id: operationId,
  return_url: 'https://app.example.com/callback',
  process_id: processId,
  seller_name: 'Vendedor',
  seller_email: 'vendedor@example.com',
  buyer_name: 'Comprador',
  buyer_email: 'comprador@example.com',
  total_commission_rate: 10,
};

const minimoGenerate = {
  operation_id: operationId,
  process_id: processId,
  seller_name: 'Vendedor',
  seller_email: 'vendedor@example.com',
  buyer_name: 'Comprador',
  buyer_email: 'comprador@example.com',
  total_commission_rate: 10,
};

async function erros(cls: any, payload: Record<string, unknown>) {
  return validate(plainToInstance(cls, payload));
}

describe('PreviewContractDto — preenchimento flexível', () => {
  // Critério de aceite da task: dá para gerar contrato com parte dos campos.
  it('aceita payload sem os campos de conteúdo do contrato', async () => {
    expect(await erros(PreviewContractDto, minimoPreview)).toHaveLength(0);
  });

  it.each([
    'seller_cpf',
    'seller_address',
    'seller_cep',
    'seller_bank',
    'seller_agency',
    'seller_checking_account',
    'buyer_cpf',
    'buyer_address',
    'buyer_cep',
    'vehicle_model',
    'vehicle_year',
    'vehicle_registration_id',
    'vehicle_serial_number',
    'vehicle_price',
    'payment_seller_value',
    'city',
  ])('%s deixou de ser obrigatório', async (campo) => {
    const errs = await erros(PreviewContractDto, minimoPreview);
    expect(errs.find((e) => e.property === campo)).toBeUndefined();
  });

  // Os que continuam obrigatórios não podem ter sido afrouxados junto.
  it.each([
    'operation_id',
    'return_url',
    'process_id',
    'seller_name',
    'seller_email',
    'buyer_name',
    'buyer_email',
    'total_commission_rate',
  ])('%s continua obrigatório', async (campo) => {
    const payload = { ...minimoPreview };
    delete (payload as Record<string, unknown>)[campo];

    const errs = await erros(PreviewContractDto, payload);
    expect(errs.some((e) => e.property === campo)).toBe(true);
  });

  // Opcional não significa "aceita lixo": o tipo ainda é validado quando vem.
  it('valida o tipo dos campos opcionais quando preenchidos', async () => {
    const errs = await erros(PreviewContractDto, {
      ...minimoPreview,
      vehicle_price: 'caro',
    });
    expect(errs.some((e) => e.property === 'vehicle_price')).toBe(true);
  });
});

describe('GenerateContractDto — preenchimento flexível', () => {
  // /contracts/generate é chamado pelo mesmo formulário; afrouxar só o preview
  // deixaria o fluxo travado no passo seguinte.
  it('aceita payload sem os campos de conteúdo do contrato', async () => {
    expect(await erros(GenerateContractDto, minimoGenerate)).toHaveLength(0);
  });

  // O backend recalcula a comissão e ignora estes valores do cliente.
  it.each([
    'platform_value',
    'platform_percentage',
    'office_value',
    'specialist_value',
  ])('%s deixou de ser obrigatório', async (campo) => {
    const errs = await erros(GenerateContractDto, minimoGenerate);
    expect(errs.find((e) => e.property === campo)).toBeUndefined();
  });

  it.each(['operation_id', 'total_commission_rate'])(
    '%s continua obrigatório',
    async (campo) => {
      const payload = { ...minimoGenerate };
      delete (payload as Record<string, unknown>)[campo];

      const errs = await erros(GenerateContractDto, payload);
      expect(errs.some((e) => e.property === campo)).toBe(true);
    },
  );
});
