import { validate } from 'class-validator';
import { CreateProcessDTO } from './dto/create-process.dto';
import { AssignProductToProcessDto } from './dto/assign-product.dto';
import { ProcessesService } from './processes.service';

const productId = '11111111-1111-4111-8111-111111111111';
const clientId = '22222222-2222-4222-8222-222222222222';
const specialistId = '33333333-3333-4333-8333-333333333333';

describe('ProcessesService — produto UUID', () => {
  it('persiste e consulta o produto pelo UUID sem conversão numérica', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const create = jest.fn().mockImplementation(({ data }) =>
      Promise.resolve({
        id: '44444444-4444-4444-8444-444444444444',
        status: 'SCHEDULING',
        product_type: data.product_type,
        ...data,
        client: { id: clientId, email: 'client@example.com', name: 'Client' },
        specialist: {
          id: specialistId,
          name: 'Specialist',
          speciality: 'CAR',
        },
        car: { id: productId, marca: 'Porsche', modelo: '911' },
        aircraft: null,
        boat: null,
        created_at: new Date(),
        notes: null,
      }),
    );
    const prisma = {
      process: { findFirst },
      $transaction: jest.fn(async (callback) =>
        callback({
          process: { create },
          processStatusHistory: { create: jest.fn().mockResolvedValue({}) },
        }),
      ),
    } as any;
    const service = new ProcessesService(prisma, {} as any);

    await service.create({
      client_id: clientId,
      specialist_id: specialistId,
      product_type: 'CAR',
      product_id: productId,
    } as unknown as CreateProcessDTO);

    expect(findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({ car_id: productId }),
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ car_id: productId }),
      }),
    );
  });

  it('aceita UUID v4 e rejeita identificador numérico nos DTOs de processo', async () => {
    const createDto = Object.assign(new CreateProcessDTO(), {
      client_id: clientId,
      specialist_id: specialistId,
      product_type: 'CAR',
      product_id: productId,
    });
    const assignDto = Object.assign(new AssignProductToProcessDto(), {
      product_type: 'CAR',
      product_id: productId,
    });

    expect(await validate(createDto)).toHaveLength(0);
    expect(await validate(assignDto)).toHaveLength(0);

    createDto.product_id = 1 as never;
    assignDto.product_id = 1 as never;

    expect((await validate(createDto)).some((error) => error.property === 'product_id')).toBe(true);
    expect((await validate(assignDto)).some((error) => error.property === 'product_id')).toBe(true);
  });
});
