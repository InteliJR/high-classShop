import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateSpecialistDto } from './update-specialist.dto';

describe('UpdateSpecialistDto', () => {
  it.each([0, 12.34, 100])('aceita comissão %s', async (commission_rate) => {
    await expect(
      validate(plainToInstance(UpdateSpecialistDto, { commission_rate })),
    ).resolves.toHaveLength(0);
  });

  it.each([-0.01, 12.345, 100.01])(
    'rejeita comissão %s',
    async (commission_rate) => {
      expect(
        await validate(
          plainToInstance(UpdateSpecialistDto, { commission_rate }),
        ),
      ).not.toHaveLength(0);
    },
  );
});
