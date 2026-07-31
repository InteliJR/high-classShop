import { AdminDatabaseService } from './admin-database.service';

function mkPrisma() {
  return {
    user: { count: jest.fn().mockResolvedValue(3) },
    company: { count: jest.fn().mockResolvedValue(1) },
    car: { count: jest.fn().mockResolvedValue(5) },
    boat: { count: jest.fn().mockResolvedValue(2) },
    aircraft: { count: jest.fn().mockResolvedValue(0) },
    process: { count: jest.fn().mockResolvedValue(4) },
    contract: { count: jest.fn().mockResolvedValue(2) },
    negotiationProposal: { count: jest.fn().mockResolvedValue(1) },
    appointment: { count: jest.fn().mockResolvedValue(6) },
  } as any;
}

describe('AdminDatabaseService — countAll', () => {
  it('retorna uma entrada por entidade do whitelist, com key/label/count', async () => {
    const svc = new AdminDatabaseService(mkPrisma());
    const result = await svc.countAll();

    expect(result).toHaveLength(9);
    expect(result).toContainEqual({ key: 'users', label: 'Usuários', count: 3 });
    expect(result).toContainEqual({
      key: 'companies',
      label: 'Escritórios',
      count: 1,
    });
    expect(result).toContainEqual({
      key: 'contracts',
      label: 'Contratos',
      count: 2,
    });
    expect(result).toContainEqual({
      key: 'appointments',
      label: 'Agendamentos',
      count: 6,
    });
  });
});
