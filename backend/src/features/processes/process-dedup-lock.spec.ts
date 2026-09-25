import { ConflictException } from '@nestjs/common';
import { ProductType } from '@prisma/client';
import { assertNoActiveProcess } from './process-dedup-lock';

describe('assertNoActiveProcess', () => {
  it('returns a stable error code when an active product process exists', async () => {
    const tx = {
      process: {
        findFirst: jest.fn().mockResolvedValue({ id: 'process-1' }),
      },
    };

    let thrown: unknown;
    try {
      await assertNoActiveProcess(tx, {
        clientId: 'client-1',
        specialistId: 'specialist-1',
        productType: ProductType.CAR,
        productId: 'car-1',
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ConflictException);
    expect((thrown as ConflictException).getResponse()).toMatchObject({
      error: {
        code: 'ACTIVE_PROCESS_EXISTS',
        message: 'Já existe processo ativo para este cliente com este produto.',
      },
    });
  });
});
