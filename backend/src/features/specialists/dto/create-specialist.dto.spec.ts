import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSpecialistDto } from './create-specialist.dto';

const base = {
  name: 'Ana',
  surname: 'Silva',
  email: 'ana@example.com',
  cnpj: '11222333000181',
  rg: '1234567',
  password_hash: 'senha-segura',
  speciality: 'CAR',
};

async function errorsFor(commission_rate?: unknown) {
  return validate(
    plainToInstance(CreateSpecialistDto, { ...base, commission_rate }),
  );
}

describe('CreateSpecialistDto', () => {
  it.each([0, 12.34, 100])('aceita comissão %s', async (commission_rate) => {
    await expect(errorsFor(commission_rate)).resolves.toHaveLength(0);
  });

  it.each([undefined, null, -0.01, 12.345, 100.01])(
    'rejeita comissão %s',
    async (commission_rate) => {
      await expect(errorsFor(commission_rate)).resolves.not.toHaveLength(0);
    },
  );

  it('rejeita notação exponencial sem lançar exceção', async () => {
    await expect(errorsFor(1e-7)).resolves.not.toHaveLength(0);
  });
});
