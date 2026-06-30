import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Request,
  Res,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { Public } from 'src/shared/decorators/public.decorator';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { GoogleMeetOAuthService } from './google-meet-oauth.service';

/**
 * Rotas OAuth da conta Google host de reuniões.
 * Só ADMIN conecta/desconecta. O callback é público (Google redireciona sem Bearer).
 */
@Controller('meetings/google/oauth')
export class GoogleMeetOAuthController {
  constructor(private readonly service: GoogleMeetOAuthService) {}

  @Get('authorize')
  @Roles(UserRole.ADMIN)
  async authorize(@Request() req: any) {
    const data = await this.service.createAuthorizeUrl(req.user.id);
    return {
      success: true,
      message: 'URL de autorização gerada com sucesso',
      data,
    };
  }

  @Get('status')
  @Roles(UserRole.ADMIN)
  async status() {
    const data = await this.service.getStatus();
    return { success: true, data };
  }

  @Post('disconnect')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async disconnect() {
    await this.service.disconnect();
    return { success: true, message: 'Conta Google desconectada' };
  }

  @Get('callback')
  @Public()
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    try {
      await this.service.handleCallback(code, state);
      return res.redirect(`${frontendUrl}/admin/settings?google=connected`);
    } catch {
      return res.redirect(`${frontendUrl}/admin/settings?google=error`);
    }
  }
}
