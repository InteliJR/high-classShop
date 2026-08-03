import { validate } from 'class-validator';
import {
  CreateConsultantProcessDto,
  ProductTypeEnum,
} from './create-consultant-process.dto';

const clientId = '11111111-1111-4111-8111-111111111111';
const specialistId = '22222222-2222-4222-8222-222222222222';
const productId = '33333333-3333-4333-8333-333333333333';

describe('CreateConsultantProcessDto', () => {
  it('aceita product_id UUID v4 para criar processo em nome do cliente', async () => {
    const dto = Object.assign(new CreateConsultantProcessDto(), {
      client_id: clientId,
      specialist_id: specialistId,
      product_type: ProductTypeEnum.CAR,
      product_id: productId,
    });

    expect(await validate(dto)).toHaveLength(0);
  });
});
