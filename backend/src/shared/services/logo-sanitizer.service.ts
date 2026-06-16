import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitizador de logo (Company branding).
 *
 * Aceita: PNG, JPEG, WebP (raster, sem risco de XSS) e SVG sanitizado.
 * Limites: raster 2MB, SVG 500KB.
 *
 * Para SVG, remove scripts, event handlers, foreignObject, href externos.
 */
export interface SanitizedLogo {
  buffer: Buffer;
  contentType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/svg+xml';
  extension: 'png' | 'jpg' | 'webp' | 'svg';
}

const RASTER_LIMIT = 2 * 1024 * 1024; // 2MB
const SVG_LIMIT = 512 * 1024; // 500KB

@Injectable()
export class LogoSanitizerService {
  /**
   * Detecta tipo real por magic bytes (não confia em mime/extensão do upload).
   * Sanitiza SVG. Rejeita tudo que não for raster suportado ou SVG seguro.
   */
  sanitize(file: {
    buffer: Buffer;
    mimetype: string;
    originalname?: string;
  }): SanitizedLogo {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Arquivo de logo vazio');
    }
    return this.sanitizeBuffer(file.buffer);
  }

  /**
   * Variante que recebe string base64 (com ou sem prefixo data:image/...;base64,).
   * Decodifica e delega para sanitizeBuffer (mesma validação por magic bytes + SVG).
   */
  sanitizeBase64(base64: string): SanitizedLogo {
    if (!base64?.length) {
      throw new BadRequestException('Logo em base64 vazio');
    }

    const match = base64.match(/^data:image\/[\w+.-]+;base64,(.+)$/i);
    const payload = match ? match[1] : base64;

    let buffer: Buffer;
    try {
      buffer = Buffer.from(payload, 'base64');
    } catch {
      throw new BadRequestException('Base64 inválido');
    }
    if (!buffer.length) {
      throw new BadRequestException('Logo em base64 vazio após decode');
    }

    return this.sanitizeBuffer(buffer);
  }

  private sanitizeBuffer(buffer: Buffer): SanitizedLogo {
    const real = this.detectByMagicBytes(buffer);

    if (real === 'png') {
      if (buffer.length > RASTER_LIMIT)
        throw new PayloadTooLargeException('Logo PNG excede 2MB');
      return { buffer, contentType: 'image/png', extension: 'png' };
    }
    if (real === 'jpg') {
      if (buffer.length > RASTER_LIMIT)
        throw new PayloadTooLargeException('Logo JPEG excede 2MB');
      return { buffer, contentType: 'image/jpeg', extension: 'jpg' };
    }
    if (real === 'webp') {
      if (buffer.length > RASTER_LIMIT)
        throw new PayloadTooLargeException('Logo WebP excede 2MB');
      return { buffer, contentType: 'image/webp', extension: 'webp' };
    }
    if (real === 'svg') {
      if (buffer.length > SVG_LIMIT)
        throw new PayloadTooLargeException('Logo SVG excede 500KB');
      const sanitized = this.sanitizeSvg(buffer.toString('utf-8'));
      return {
        buffer: Buffer.from(sanitized, 'utf-8'),
        contentType: 'image/svg+xml',
        extension: 'svg',
      };
    }

    throw new BadRequestException(
      'Formato de logo inválido. Aceitos: PNG, JPEG, WebP, SVG.',
    );
  }

  /**
   * Detecta tipo por magic bytes. Retorna null se não reconhecido.
   * Não confia em mimetype do upload (cliente pode forjar).
   */
  private detectByMagicBytes(
    buf: Buffer,
  ): 'png' | 'jpg' | 'webp' | 'svg' | null {
    if (buf.length < 4) return null;

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47
    )
      return 'png';

    // JPEG: FF D8 FF
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';

    // WebP: RIFF....WEBP
    if (
      buf.length >= 12 &&
      buf.toString('ascii', 0, 4) === 'RIFF' &&
      buf.toString('ascii', 8, 12) === 'WEBP'
    )
      return 'webp';

    // SVG: texto começa com `<?xml` ou `<svg` (após whitespace/BOM)
    const head = buf
      .slice(0, Math.min(buf.length, 512))
      .toString('utf-8')
      .trimStart();
    if (head.startsWith('<?xml') || head.toLowerCase().startsWith('<svg')) {
      return 'svg';
    }

    return null;
  }

  /**
   * Sanitiza SVG removendo scripts, handlers, hrefs externos.
   *
   * DOMPurify com profile SVG strict:
   *  - sem <script>, <foreignObject>, <iframe>
   *  - sem atributos on* (onclick, onload, etc)
   *  - sem href/xlink:href apontando pra esquemas perigosos (javascript:, data:)
   *  - sem CSS expressions
   *
   * Defesa em profundidade: valida pós-sanitização que tags/atrs proibidos sumiram.
   */
  private sanitizeSvg(raw: string): string {
    const clean = DOMPurify.sanitize(raw, {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'object', 'embed'],
      FORBID_ATTR: [
        'onerror',
        'onload',
        'onclick',
        'onmouseover',
        'onfocus',
        'onsubmit',
      ],
      ALLOWED_URI_REGEXP:
        /^(?:(?:https?|mailto|tel|ftp|sftp|#):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
    });

    // Double-check: regex paranoica pra coisas que DOMPurify *deveria* ter pego.
    const lower = clean.toLowerCase();
    const blacklist = [
      '<script',
      '<foreignobject',
      '<iframe',
      'javascript:',
      'vbscript:',
      ' on', // qualquer atributo on*
    ];
    for (const bad of blacklist) {
      if (lower.includes(bad)) {
        // ' on' é heurística — confirmar que é atributo (= depois)
        if (bad === ' on' && !/\son[a-z]+\s*=/i.test(clean)) continue;
        throw new BadRequestException(
          'SVG contém conteúdo proibido após sanitização',
        );
      }
    }

    return clean;
  }
}
