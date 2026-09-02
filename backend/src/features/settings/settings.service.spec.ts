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
