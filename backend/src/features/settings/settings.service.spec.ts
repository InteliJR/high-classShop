import { BadRequestException } from '@nestjs/common';
import { SettingKey, SettingsService } from './settings.service';

describe('SettingsService minimum proposal percentage', () => {
  it.each(['-0.01', '1.01', 'not-a-number'])(
    'rejects API fraction outside 0..1: %s',
    async (value) => {
      const upsert = jest.fn().mockResolvedValue({
        key: SettingKey.MINIMUM_PROPOSAL_PERCENTAGE,
        value,
        description: null,
      });
      const service = new SettingsService({
        settings: { upsert },
      } as any);

      await expect(
        service.update(SettingKey.MINIMUM_PROPOSAL_PERCENTAGE, value),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(upsert).not.toHaveBeenCalled();
    },
  );

  it.each(['0', '0.8', '1'])(
    'accepts API fraction inside 0..1: %s',
    async (value) => {
      const upsert = jest.fn().mockResolvedValue({
        key: SettingKey.MINIMUM_PROPOSAL_PERCENTAGE,
        value,
        description: null,
      });
      const service = new SettingsService({
        settings: { upsert },
      } as any);

      await expect(
        service.update(SettingKey.MINIMUM_PROPOSAL_PERCENTAGE, value),
      ).resolves.toMatchObject({ value });
    },
  );
});

describe('SettingsService minimum proposal availability', () => {
  function setup(storedValue = 'true') {
    const findUnique = jest.fn().mockResolvedValue({
      key: SettingKey.MINIMUM_PROPOSAL_ENABLED,
      value: storedValue,
      description: null,
    });
    const upsert = jest.fn().mockResolvedValue({
      key: SettingKey.MINIMUM_PROPOSAL_ENABLED,
      value: 'false',
      description: null,
    });
    const service = new SettingsService({
      settings: { findUnique, upsert },
    } as any);

    return { service, findUnique, upsert };
  }

  it('permanece desligado mesmo quando o banco contém true', async () => {
    const { service, findUnique } = setup('true');

    await expect(service.isMinimumProposalEnabled()).resolves.toBe(false);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('recusa tentativa administrativa de ativação', async () => {
    const { service, upsert } = setup();

    await expect(
      service.update(SettingKey.MINIMUM_PROPOSAL_ENABLED, 'true'),
    ).rejects.toMatchObject({
      response: {
        error: {
          code: 400,
          message: 'A validação de valor mínimo de propostas está indisponível',
        },
      },
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('permite persistir explicitamente o estado desligado', async () => {
    const { service, upsert } = setup();

    await expect(
      service.update(SettingKey.MINIMUM_PROPOSAL_ENABLED, 'false'),
    ).resolves.toMatchObject({ value: 'false' });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { value: 'false' },
        create: expect.objectContaining({ value: 'false' }),
      }),
    );
  });
});
