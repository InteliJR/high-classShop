import { PATH_METADATA } from '@nestjs/common/constants';
import { IS_PUBLIC_KEY } from 'src/shared/decorators/public.decorator';
import { SpecialistsController } from './specialists.controller';

describe('SpecialistsController public profile', () => {
  it('protege a listagem administrativa com ADMIN', () => {
    expect(
      Reflect.getMetadata('roles', SpecialistsController.prototype.findAll),
    ).toEqual(['ADMIN']);
    expect(
      Reflect.getMetadata(
        IS_PUBLIC_KEY,
        SpecialistsController.prototype.findAll,
      ),
    ).not.toBe(true);
  });

  it('protege o cadastro completo com ADMIN', () => {
    expect(
      Reflect.getMetadata('roles', SpecialistsController.prototype.findOne),
    ).toEqual(['ADMIN']);
    expect(
      Reflect.getMetadata(
        IS_PUBLIC_KEY,
        SpecialistsController.prototype.findOne,
      ),
    ).not.toBe(true);
  });

  it('publica a rota dedicada antes da rota genérica', () => {
    const prototype = SpecialistsController.prototype;
    expect(
      Reflect.getMetadata(PATH_METADATA, prototype.findPublicProfile),
    ).toBe(':id/public-profile');
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, prototype.findPublicProfile),
    ).toBe(true);
    const methods = Object.getOwnPropertyNames(prototype);
    expect(methods.indexOf('findPublicProfile')).toBeLessThan(
      methods.indexOf('findOne'),
    );
  });

  it('encaminha o ID para a projeção segura', async () => {
    const profile = {
      id: 'specialist-1',
      calendly_scheduling_available: false,
    };
    const service = { findPublicProfile: jest.fn().mockResolvedValue(profile) };
    const controller = new SpecialistsController(service as any);
    expect(await controller.findPublicProfile('specialist-1')).toBe(profile);
    expect(service.findPublicProfile).toHaveBeenCalledWith('specialist-1');
  });
});
