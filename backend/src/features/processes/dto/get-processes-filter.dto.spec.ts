import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import { GetProcessesFilterDto } from './get-processes-filter.dto';

describe('GetProcessesFilterDto', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const metadata: ArgumentMetadata = {
    type: 'query',
    metatype: GetProcessesFilterDto,
    data: undefined,
  };

  it('accepts the represented specialist query parameter', async () => {
    const specialistId = 'b11d0000-0000-4000-8000-000000000002';
    await expect(
      pipe.transform({ target_specialist_id: specialistId, page: '1' }, metadata),
    ).resolves.toMatchObject({ target_specialist_id: specialistId, page: 1 });
  });

  it('rejects a malformed represented specialist id', async () => {
    await expect(
      pipe.transform({ target_specialist_id: 'another-specialist' }, metadata),
    ).rejects.toThrow();
  });
});
