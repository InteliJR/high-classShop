import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { InviteSpecialistDto } from './invite-specialist.dto';

const base = {
  email: 'especialista@example.com',
  speciality: 'CAR',
};

async function errorsFor(commission_rate?: unknown) {
  return validate(
    plainToInstance(InviteSpecialistDto, { ...base, commission_rate }),
  );
}

describe('InviteSpecialistDto', () => {
  it('normaliza o e-mail antes da validação', async () => {
    const dto = plainToInstance(InviteSpecialistDto, {
      email: ' Especialista@Example.COM ',
      speciality: 'CAR',
      commission_rate: 25,
    });

    expect(dto.email).toBe('especialista@example.com');
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each([0, 12.34, 100])('aceita comissão %s', async (rate) => {
    await expect(errorsFor(rate)).resolves.toHaveLength(0);
  });

  it.each([undefined, null, -0.01, 100.01, 12.345])(
    'rejeita comissão %s',
    async (rate) => {
      expect(await errorsFor(rate)).not.toHaveLength(0);
    },
  );

  it('rejeita notação exponencial sem lançar exceção', async () => {
    await expect(errorsFor(1e-7)).resolves.not.toHaveLength(0);
  });
});
