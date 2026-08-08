import { BadRequestException } from '@nestjs/common';
import { AdminDatabaseService } from './admin-database.service';

function mkPrisma(overrides: Record<string, any> = {}) {
  const base = {
    user: { count: jest.fn().mockResolvedValue(3), findMany: jest.fn().mockResolvedValue([]) },
    company: { count: jest.fn().mockResolvedValue(1), findMany: jest.fn().mockResolvedValue([]) },
    car: { count: jest.fn().mockResolvedValue(5), findMany: jest.fn().mockResolvedValue([]) },
    boat: { count: jest.fn().mockResolvedValue(2), findMany: jest.fn().mockResolvedValue([]) },
    aircraft: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    process: { count: jest.fn().mockResolvedValue(4), findMany: jest.fn().mockResolvedValue([]) },
    contract: { count: jest.fn().mockResolvedValue(2), findMany: jest.fn().mockResolvedValue([]) },
  };
  return { ...base, ...overrides } as any;
}

function mkS3() {
  return { getSignedUrl: jest.fn().mockResolvedValue('https://s3.example/assinada') } as any;
}

function mkSvc(prisma = mkPrisma(), s3 = mkS3()) {
  return new AdminDatabaseService(prisma, s3);
}

/** Acha o índice de uma coluna pelo label — deixa os testes independentes da ordem. */
function col(columns: { label: string }[], label: string): number {
  const i = columns.findIndex((c) => c.label === label);
  if (i < 0) throw new Error(`Coluna "${label}" não existe. Existem: ${columns.map((c) => c.label).join(', ')}`);
  return i;
}

describe('AdminDatabaseService — whitelist', () => {
  it('não expõe mais Propostas nem Agendamentos', async () => {
    const keys = mkSvc().listEntities().map((e) => e.key);
    expect(keys).not.toContain('proposals');
    expect(keys).not.toContain('appointments');
  });

  it('expõe exatamente as 7 entidades curadas', async () => {
    expect(mkSvc().listEntities().map((e) => e.key)).toEqual([
      'users', 'companies', 'cars', 'boats', 'aircrafts', 'processes', 'contracts',
    ]);
  });

  it('countAll devolve uma entrada por entidade, com key/label/count', async () => {
    const result = await mkSvc().countAll();
    expect(result).toHaveLength(7);
    expect(result).toContainEqual({ key: 'users', label: 'Usuários', count: 3 });
    expect(result).toContainEqual({ key: 'contracts', label: 'Contratos', count: 2 });
  });

  it('rejeita entidade fora da whitelist', async () => {
    await expect(mkSvc().list('proposals', 1, 20)).rejects.toThrow(BadRequestException);
    await expect(mkSvc().list('refreshToken', 1, 20)).rejects.toThrow(BadRequestException);
  });
});

describe('AdminDatabaseService — usuários', () => {
  const usuario = {
    name: 'João', surname: 'Silva', email: 'joao@ex.com',
    role: 'CONSULTANT', cpf: '12345678901', rg: '123456789',
    phone: '11987654321', speciality: 'AIRCRAFT',
    commission_rate: { toString: () => '15.00' },
    identification_number: 'ID-9', is_active: true,
    company: { name: 'Escritório Alfa' },
    consultant: { name: 'Ana', surname: 'Costa' },
  };

  async function listarUsuarios(row: any = usuario) {
    const prisma = mkPrisma({
      user: { count: jest.fn().mockResolvedValue(1), findMany: jest.fn().mockResolvedValue([row]) },
    });
    return { prisma, result: await mkSvc(prisma).list('users', 1, 20) };
  }

  it('mostra nome de escritório e de consultor no lugar dos UUIDs', async () => {
    const { result } = await listarUsuarios();
    expect(result.data[0][col(result.columns, 'Escritório')]).toBe('Escritório Alfa');
    expect(result.data[0][col(result.columns, 'Consultor')]).toBe('Ana Costa');
  });

  it('mascara documento e telefone, e traduz papel e especialidade', async () => {
    const { result } = await listarUsuarios();
    const row = result.data[0];
    expect(row[col(result.columns, 'CPF/CNPJ')]).toBe('123.456.789-01');
    expect(row[col(result.columns, 'Telefone')]).toBe('(11) 98765-4321');
    expect(row[col(result.columns, 'Papel')]).toBe('Consultor');
    expect(row[col(result.columns, 'Especialidade')]).toBe('Aeronave');
    expect(row[col(result.columns, 'Taxa de comissão')]).toBe('15,00%');
  });

  it('nunca projeta password_hash na query', async () => {
    const { prisma } = await listarUsuarios();
    const args = prisma.user.findMany.mock.calls[0][0];
    expect(args.select).toBeDefined();
    expect(args.select.password_hash).toBeUndefined();
    expect(JSON.stringify(args.select)).not.toContain('password_hash');
  });

  it('devolve travessão para relação e campos ausentes', async () => {
    const { result } = await listarUsuarios({
      ...usuario, company: null, consultant: null, phone: null, commission_rate: null,
    });
    const row = result.data[0];
    expect(row[col(result.columns, 'Escritório')]).toBe('—');
    expect(row[col(result.columns, 'Consultor')]).toBe('—');
    expect(row[col(result.columns, 'Telefone')]).toBe('—');
    expect(row[col(result.columns, 'Taxa de comissão')]).toBe('—');
  });

  it('devolve cabeçalho mesmo com a página vazia', async () => {
    const result = await mkSvc().list('users', 1, 20);
    expect(result.data).toEqual([]);
    expect(result.columns.length).toBeGreaterThan(0);
  });
});

describe('AdminDatabaseService — escritórios', () => {
  const escritorio = {
    name: 'Alfa', cnpj: '12345678000199', slug: 'alfa', description: 'Escritório',
    commission_rate: { toString: () => '10.00' }, platform_commission_rate: null,
    bank: 'Itaú', agency: '0001', checking_account: '12345-6',
    color_identity: ['#0F172A', '#EAB308'], logo: 'companies/abc/logo-1.png',
    created_at: new Date('2026-03-01T12:00:00Z'),
  };

  async function listarEscritorios(row: any = escritorio, s3 = mkS3()) {
    const prisma = mkPrisma({
      company: { count: jest.fn().mockResolvedValue(1), findMany: jest.fn().mockResolvedValue([row]) },
    });
    return { s3, result: await mkSvc(prisma, s3).list('companies', 1, 20) };
  }

  it('devolve célula de imagem com URL assinada no lugar da key do S3', async () => {
    const { s3, result } = await listarEscritorios();
    expect(result.data[0][col(result.columns, 'Logo')]).toEqual({
      kind: 'image', url: 'https://s3.example/assinada', alt: 'Logo Alfa',
    });
    expect(s3.getSignedUrl).toHaveBeenCalledWith('companies/abc/logo-1.png');
  });

  it('devolve url nula quando não há logo, sem chamar o S3', async () => {
    const { s3, result } = await listarEscritorios({ ...escritorio, logo: null });
    expect(result.data[0][col(result.columns, 'Logo')]).toEqual({
      kind: 'image', url: null, alt: 'Logo Alfa',
    });
    expect(s3.getSignedUrl).not.toHaveBeenCalled();
  });

  it('mascara CNPJ e formata taxas e cores', async () => {
    const { result } = await listarEscritorios();
    const row = result.data[0];
    expect(row[col(result.columns, 'CNPJ')]).toBe('12.345.678/0001-99');
    expect(row[col(result.columns, 'Taxa de comissão')]).toBe('10,00%');
    expect(row[col(result.columns, 'Taxa da plataforma')]).toBe('—');
    expect(row[col(result.columns, 'Cores')]).toBe('#0F172A, #EAB308');
  });
});

describe('AdminDatabaseService — produtos', () => {
  it('formata carro: valor em real, estado e categoria em pt-BR, especialista por nome', async () => {
    const prisma = mkPrisma({
      car: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([{
          marca: 'Ferrari', modelo: 'F8 Tributo', ano: 2022,
          valor: { toString: () => '2400000.00' },
          estado: 'seminovo', tipo_categoria: 'supercarro',
          cor: 'Vermelho', km: 12000, cambio: 'Automático',
          combustivel: 'Gasolina', identificador: 'ABC1D23',
          is_active: true, created_at: new Date('2026-03-01T12:00:00Z'),
          specialist: { name: 'Ana', surname: 'Costa' },
        }]),
      },
    });
    const result = await mkSvc(prisma).list('cars', 1, 20);
    const row = result.data[0];

    expect(row[col(result.columns, 'Valor')]).toBe('R$ 2.400.000,00');
    expect(row[col(result.columns, 'Estado')]).toBe('Seminovo');
    expect(row[col(result.columns, 'Categoria')]).toBe('Supercarro');
    expect(row[col(result.columns, 'Quilometragem')]).toBe('12.000');
    expect(row[col(result.columns, 'Especialista')]).toBe('Ana Costa');
  });

  it('formata barco: tipo de embarcação em pt-BR', async () => {
    const prisma = mkPrisma({
      boat: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([{
          marca: 'Azimut', modelo: 'Grande 27', ano: 2021,
          valor: { toString: () => '9000000.00' },
          estado: 'novo', tipo_embarcacao: 'iate',
          fabricante: 'Azimut', tamanho: '27m', estilo: 'Flybridge',
          motor: 'MTU', ano_motor: 2021, combustivel: 'Diesel',
          identificador: 'HULL-9', is_active: true,
          created_at: new Date('2026-03-01T12:00:00Z'), specialist: null,
        }]),
      },
    });
    const result = await mkSvc(prisma).list('boats', 1, 20);
    const row = result.data[0];

    expect(row[col(result.columns, 'Tipo de embarcação')]).toBe('Iate');
    expect(row[col(result.columns, 'Estado')]).toBe('Novo');
    expect(row[col(result.columns, 'Especialista')]).toBe('—');
  });

  it('formata aeronave: tipo em pt-BR', async () => {
    const prisma = mkPrisma({
      aircraft: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([{
          marca: 'Embraer', modelo: 'Phenom 300', ano: 2020,
          valor: { toString: () => '55000000.00' },
          estado: 'seminovo', tipo_aeronave: 'executivo_medio',
          categoria: 'Executivo', assentos: 9, identificador: 'PR-ABC',
          is_active: true, created_at: new Date('2026-03-01T12:00:00Z'),
          specialist: { name: 'Ana', surname: 'Costa' },
        }]),
      },
    });
    const result = await mkSvc(prisma).list('aircrafts', 1, 20);
    const row = result.data[0];

    expect(row[col(result.columns, 'Tipo de aeronave')]).toBe('Executivo médio');
    expect(row[col(result.columns, 'Valor')]).toBe('R$ 55.000.000,00');
    expect(row[col(result.columns, 'Categoria')]).toBe('Executivo');
  });

  it('formata carro com especialista nulo: devolve travessão', async () => {
    const prisma = mkPrisma({
      car: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([{
          marca: 'Ferrari', modelo: 'F8 Tributo', ano: 2022,
          valor: { toString: () => '2400000.00' },
          estado: 'seminovo', tipo_categoria: 'supercarro',
          cor: 'Vermelho', km: 12000, cambio: 'Automático',
          combustivel: 'Gasolina', identificador: 'ABC1D23',
          is_active: true, created_at: new Date('2026-03-01T12:00:00Z'),
          specialist: null,
        }]),
      },
    });
    const result = await mkSvc(prisma).list('cars', 1, 20);
    const row = result.data[0];

    expect(row[col(result.columns, 'Especialista')]).toBe('—');
  });

  it('formata aeronave com especialista nulo: devolve travessão', async () => {
    const prisma = mkPrisma({
      aircraft: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([{
          marca: 'Embraer', modelo: 'Phenom 300', ano: 2020,
          valor: { toString: () => '55000000.00' },
          estado: 'seminovo', tipo_aeronave: 'executivo_medio',
          categoria: 'Executivo', assentos: 9, identificador: 'PR-ABC',
          is_active: true, created_at: new Date('2026-03-01T12:00:00Z'),
          specialist: null,
        }]),
      },
    });
    const result = await mkSvc(prisma).list('aircrafts', 1, 20);
    const row = result.data[0];

    expect(row[col(result.columns, 'Especialista')]).toBe('—');
  });
});

describe('AdminDatabaseService — processos', () => {
  const processo = {
    id: 'a3f1b2c3-0000-0000-0000-000000000000',
    product_type: 'CAR', status: 'NEGOTIATION',
    notes: 'Cliente pediu test drive antes de fechar',
    active_contract_id: null,
    created_at: new Date('2026-03-01T12:00:00Z'),
    client: { name: 'João', surname: 'Silva' },
    specialist: { name: 'Ana', surname: 'Costa' },
    car: { marca: 'Ferrari', modelo: 'F8 Tributo' },
    boat: null, aircraft: null,
    appointment: { appointment_datetime: new Date('2026-03-12T17:00:00Z') },
    accepted_proposal: { proposed_value: { toString: () => '2400000.00' } },
  };

  async function listarProcessos(row: any = processo) {
    const prisma = mkPrisma({
      process: { count: jest.fn().mockResolvedValue(1), findMany: jest.fn().mockResolvedValue([row]) },
    });
    return mkSvc(prisma).list('processes', 1, 20);
  }

  it('não expõe nenhuma coluna de UUID de relação', async () => {
    const labels = (await listarProcessos()).columns.map((c) => c.label);
    for (const proibida of [
      'ID do cliente', 'ID do especialista', 'ID do carro', 'ID da aeronave',
      'ID da embarcação', 'ID do produto', 'ID do agendamento',
      'ID da proposta aceita', 'ID do contrato ativo',
    ]) {
      expect(labels).not.toContain(proibida);
    }
  });

  it('mostra pessoas por nome e o produto colapsado numa coluna só', async () => {
    const result = await listarProcessos();
    const row = result.data[0];
    expect(row[col(result.columns, 'Cliente')]).toBe('João Silva');
    expect(row[col(result.columns, 'Especialista')]).toBe('Ana Costa');
    expect(row[col(result.columns, 'Produto')]).toBe('Ferrari F8 Tributo');
    expect(row[col(result.columns, 'Tipo')]).toBe('Carro');
  });

  it('colapsa barco e aeronave na mesma coluna Produto', async () => {
    const comBarco = await listarProcessos({
      ...processo, product_type: 'BOAT', car: null,
      boat: { marca: 'Azimut', modelo: 'Grande 27' },
    });
    expect(comBarco.data[0][col(comBarco.columns, 'Produto')]).toBe('Azimut Grande 27');

    const comAeronave = await listarProcessos({
      ...processo, product_type: 'AIRCRAFT', car: null,
      aircraft: { marca: 'Embraer', modelo: 'Phenom 300' },
    });
    expect(comAeronave.data[0][col(comAeronave.columns, 'Produto')]).toBe('Embraer Phenom 300');
  });

  it('troca os UUIDs de agendamento e proposta por data e valor', async () => {
    const result = await listarProcessos();
    const row = result.data[0];
    // 17:00 UTC = 14:00 em São Paulo.
    expect(row[col(result.columns, 'Agendamento')]).toBe('12/03/2026 14:00');
    expect(row[col(result.columns, 'Valor aceito')]).toBe('R$ 2.400.000,00');
  });

  it('mostra contrato ativo como Sim/Não em vez de UUID', async () => {
    const sem = await listarProcessos();
    expect(sem.data[0][col(sem.columns, 'Contrato')]).toBe('Não');

    const com = await listarProcessos({ ...processo, active_contract_id: 'uuid-qualquer' });
    expect(com.data[0][col(com.columns, 'Contrato')]).toBe('Sim');
  });

  it('mostra o ID curto do processo para referência', async () => {
    const result = await listarProcessos();
    expect(result.data[0][col(result.columns, 'ID')]).toBe('#a3f1b2c3');
  });

  it('traduz o status', async () => {
    const result = await listarProcessos();
    expect(result.data[0][col(result.columns, 'Status')]).toBe('Em negociação');
  });

  it('marca Observações como coluna larga para não ser truncada', async () => {
    const result = await listarProcessos();
    expect(result.columns[col(result.columns, 'Observações')].wide).toBe(true);
    expect(result.data[0][col(result.columns, 'Observações')]).toBe(
      'Cliente pediu test drive antes de fechar',
    );
  });

  it('trata processo de consultoria (sem produto e sem agendamento)', async () => {
    const result = await listarProcessos({
      ...processo, product_type: null, car: null, boat: null, aircraft: null,
      appointment: null, accepted_proposal: null, notes: null,
    });
    const row = result.data[0];
    expect(row[col(result.columns, 'Produto')]).toBe('—');
    expect(row[col(result.columns, 'Tipo')]).toBe('—');
    expect(row[col(result.columns, 'Agendamento')]).toBe('—');
    expect(row[col(result.columns, 'Valor aceito')]).toBe('—');
    expect(row[col(result.columns, 'Observações')]).toBe('—');
  });
});
