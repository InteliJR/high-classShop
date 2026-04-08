import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';
import { Public } from 'src/shared/decorators/public.decorator';
import { CalendlyIntegrationService } from './calendly-integration.service';
import type { Request as ExpressRequest, Response } from 'express';

@Controller('appointments/calendly')
@UseGuards(AuthGuard)
export class CalendlyController {
  constructor(
    private readonly calendlyIntegrationService: CalendlyIntegrationService,
  ) {}

  @Get('oauth/authorize')
  async getAuthorizeUrl(@Request() req: any) {
    const userId = req.user.id;
    const data =
      await this.calendlyIntegrationService.createAuthorizeUrl(userId);

    return {
      success: true,
      message: 'URL de autorização gerada com sucesso',
      data,
    };
  }

  @Get('oauth/status')
  async getOAuthStatus(@Request() req: any) {
    const userId = req.user.id;
    const data = await this.calendlyIntegrationService.getOAuthStatus(userId);

    return {
      success: true,
      message: 'Status da integração Calendly obtido com sucesso',
      data,
    };
  }

  @Post('oauth/disconnect')
  @HttpCode(HttpStatus.OK)
  async disconnect(@Request() req: any) {
    const userId = req.user.id;
    await this.calendlyIntegrationService.disconnect(userId);

    return {
      success: true,
      message: 'Integração Calendly desconectada com sucesso',
    };
  }

  @Public()
  @Get('oauth/callback')
  async oauthCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Res() res: Response,
  ) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

    if (error) {
      const reason = encodeURIComponent(errorDescription || error);
      return res.redirect(
        `${frontendUrl}/profile?calendly=error&reason=${reason}`,
      );
    }

    if (!code || !state) {
      throw new BadRequestException(
        'Parâmetros code/state são obrigatórios no callback OAuth',
      );
    }

    try {
      await this.calendlyIntegrationService.handleOAuthCallback(code, state);
      return res.redirect(`${frontendUrl}/profile?calendly=connected`);
    } catch (callbackError: any) {
      const reason = encodeURIComponent(
        callbackError?.response?.data?.error_description ||
          callbackError?.response?.data?.message ||
          callbackError?.message ||
          'Falha ao conectar Calendly',
      );

      return res.redirect(
        `${frontendUrl}/profile?calendly=error&reason=${reason}`,
      );
    }
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async receiveWebhook(
    @Request() req: ExpressRequest & { rawBody?: string },
    @Headers('calendly-webhook-signature') signatureHeader: string | undefined,
  ) {
    const data = await this.calendlyIntegrationService.processWebhook(
      req.body,
      req.rawBody,
      signatureHeader,
    );

    return {
      success: true,
      message: data.message,
      data,
    };
  }
}
