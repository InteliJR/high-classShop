// Mocka isomorphic-dompurify (puxa jsdom ESM, incompatível com jest default config)
// — companies.service.ts importa LogoSanitizerService transitivamente.
jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: { sanitize: jest.fn((input: string) => input) },
}));

import { NotFoundException } from '@nestjs/common';
import { CompaniesService } from './companies.service';

function mkSvc(company: any) {
  const prisma = {
    company: { findUnique: jest.fn().mockResolvedValue(company) },
  } as any;
  const svc = new CompaniesService(
    prisma,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
  (svc as any).resolveLogoUrl = jest.fn().mockResolvedValue('https://logo');
  return { svc, prisma };
}

describe('CompaniesService.findBySlug', () => {
  it('retorna branding público quando o slug existe', async () => {
    const { svc } = mkSvc({
      id: 'c1',
      name: 'Alpha',
      slug: 'alpha',
      logo: 'companies/x.png',
      background_image: 'companies/x/background.png',
      color_identity: ['#111', '#222'],
    });

    const result = await svc.findBySlug('alpha');

    expect(result).toEqual({
      id: 'c1',
      name: 'Alpha',
      slug: 'alpha',
      logoUrl: 'https://logo',
      backgroundImageUrl: 'https://logo',
      color_identity: ['#111', '#222'],
    });
  });

  it('retorna backgroundImageUrl null quando o escritório não configurou imagem', async () => {
    const { svc } = mkSvc({
      id: 'c1',
      name: 'Alpha',
      slug: 'alpha',
      logo: null,
      background_image: null,
      color_identity: [],
    });
    (svc as any).resolveLogoUrl = jest.fn().mockResolvedValue(null);

    const result = await svc.findBySlug('alpha');

    expect(result.backgroundImageUrl).toBeNull();
  });

  it('lança NotFound quando o slug não existe', async () => {
    const { svc } = mkSvc(null);
    await expect(svc.findBySlug('nope')).rejects.toThrow(NotFoundException);
  });
});
