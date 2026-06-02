// Mocka isomorphic-dompurify (puxa jsdom ESM, incompatível com jest default config)
// Validamos o pipeline (chamada + paranoid check) — XSS real é responsabilidade da lib.
jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: {
    sanitize: jest.fn((input: string) => {
      // Simula sanitização básica: remove <script>, atributos on*, foreignObject, javascript:
      return input
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
        .replace(/\s+on[a-z]+\s*=\s*("|')[^"']*\1/gi, '')
        .replace(/href\s*=\s*("|')javascript:[^"']*\1/gi, 'href=""');
    }),
  },
}));

import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { LogoSanitizerService } from './logo-sanitizer.service';

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const WEBP_HEADER = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from('WEBP', 'ascii'),
]);

function mkFile(buffer: Buffer, mime = 'application/octet-stream'): any {
  return { buffer, mimetype: mime };
}

describe('LogoSanitizerService', () => {
  let svc: LogoSanitizerService;
  beforeEach(() => (svc = new LogoSanitizerService()));

  // C9: PNG renomeado .svg — detectByMagicBytes pega
  it('aceita PNG por magic bytes (independente de mime)', () => {
    const r = svc.sanitize(mkFile(Buffer.concat([PNG_HEADER, Buffer.from('rest')])));
    expect(r.extension).toBe('png');
  });

  it('aceita JPEG por magic bytes', () => {
    const r = svc.sanitize(mkFile(JPG_HEADER));
    expect(r.extension).toBe('jpg');
  });

  it('aceita WebP por magic bytes', () => {
    const r = svc.sanitize(mkFile(WEBP_HEADER));
    expect(r.extension).toBe('webp');
  });

  // C10: .exe renomeado .png → rejeita
  it('rejeita binário desconhecido (sem magic bytes válido)', () => {
    const fake = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // PE/Windows exe header
    expect(() => svc.sanitize(mkFile(fake))).toThrow(BadRequestException);
  });

  it('rejeita buffer vazio', () => {
    expect(() => svc.sanitize(mkFile(Buffer.alloc(0)))).toThrow(BadRequestException);
  });

  // C11: SVG >500KB (limite 512*1024 = 524288)
  it('rejeita SVG acima de 500KB', () => {
    const big = '<svg>' + 'x'.repeat(600_000) + '</svg>';
    expect(() => svc.sanitize(mkFile(Buffer.from(big)))).toThrow(PayloadTooLargeException);
  });

  it('rejeita PNG acima de 2MB', () => {
    const big = Buffer.concat([PNG_HEADER, Buffer.alloc(2 * 1024 * 1024 + 10)]);
    expect(() => svc.sanitize(mkFile(big))).toThrow(PayloadTooLargeException);
  });

  // C6: SVG com <script>
  it('remove <script> de SVG', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle/></svg>';
    const r = svc.sanitize(mkFile(Buffer.from(svg)));
    expect(r.buffer.toString()).not.toMatch(/<script/i);
    expect(r.buffer.toString()).toContain('circle');
  });

  // C7: SVG com onclick
  it('remove atributos on* (onclick/onload)', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><a onclick="x()" onload="y()"><circle/></a></svg>';
    const r = svc.sanitize(mkFile(Buffer.from(svg)));
    expect(r.buffer.toString()).not.toMatch(/onclick=/i);
    expect(r.buffer.toString()).not.toMatch(/onload=/i);
  });

  // C8: foreignObject removido
  it('remove <foreignObject>', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body><script>x</script></body></foreignObject></svg>';
    const r = svc.sanitize(mkFile(Buffer.from(svg)));
    expect(r.buffer.toString()).not.toMatch(/foreignobject/i);
    expect(r.buffer.toString()).not.toMatch(/<script/i);
  });

  // SVG válido limpo passa
  it('aceita SVG limpo', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="5"/></svg>';
    const r = svc.sanitize(mkFile(Buffer.from(svg)));
    expect(r.contentType).toBe('image/svg+xml');
    expect(r.buffer.toString()).toContain('circle');
  });

  // SVG com javascript: URI
  it('remove URIs javascript: em href', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><circle/></a></svg>';
    const r = svc.sanitize(mkFile(Buffer.from(svg)));
    expect(r.buffer.toString().toLowerCase()).not.toContain('javascript:');
  });
});
