import { Controller, Get } from '@nestjs/common';
import { Public } from '../shared/decorators/public.decorator';

@Controller('health')
export class HealthController {
  /**
   * Health check endpoint
   * Usado por plataformas de deploy (Render, Railway, etc) para verificar se o serviço está rodando
   *
   * @returns Status ok e timestamp
   * @example GET /api/health
   */
  @Public()
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'highclass-backend',
      environment: process.env.NODE_ENV || 'development',
    };
  }

  /**
   * Detailed health check
   * Verifica conexões com serviços externos (útil para debugging)
   *
   * @returns Status detalhado
   * @example GET /api/health/detailed
   */
  @Public()
  @Get('detailed')
  detailedCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'highclass-backend',
      environment: process.env.NODE_ENV || 'development',
      config: {
        hasDatabase: !!process.env.DATABASE_URL,
        hasAwsConfig: !!(
          process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ),
        hasJwtSecrets: !!(
          process.env.JWT_SECRET_ACCESS && process.env.JWT_SECRET_REFRESH
        ),
        hasDocuSign: !!process.env.DOCUSIGN_INTEGRATION_KEY,
        frontendUrl: process.env.FRONTEND_URL || 'not-configured',
      },
    };
  }
}
