import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
  Res,
  Req,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import * as auth from './dto/auth';
import { AuthGuard } from './auth.guard';
import express from 'express';
import { Public } from 'src/shared/decorators/public.decorator';
import { RateLimit } from 'src/shared/decorators/rate-limit.decorator';
import { RateLimitGuard } from 'src/shared/guards/rate-limit.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() body: auth.UserRegisterDto) {
    const { user } = await this.authService.register(body);
    return {
      sucess: true,
      message: 'Conta criada com sucesso',
      data: {
        user: user,
      },
    };
  }

  @Public()
  @Post('validate-referral')
  async validateReferralToken(@Body() body: { token: string }) {
    const payload = await this.authService.validateReferralToken(body.token);
    return {
      success: true,
      message: 'Token válido',
      data: payload,
    };
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ windowMs: 900, max: 5 }) // 5 attempts per 15 minutes
  @Post('login')
  async login(
    @Body() body: auth.LoginDto,
    @Res({ passthrough: true }) response: express.Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.authService.login(body);

    response.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // true apenas em produção (HTTPS)
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' em produção para cross-site
      path: '/', // Enviar cookie em todas as requisições
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    });

    return {
      sucess: true,
      message: 'Login realizado com sucesso',
      data: {
        access_token: accessToken,
        user: user,
      },
    };
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Req() request: express.Request,
    @Res({ passthrough: true }) response: express.Response,
  ) {
    const refreshToken = request.cookies.refreshToken;
    const {
      accessToken,
      refreshToken: newRefreshToken,
      user,
    } = await this.authService.refresh(refreshToken);

    // Set new refresh token cookie
    response.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // true apenas em produção (HTTPS)
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' em produção para cross-site
      path: '/', // Enviar cookie em todas as requisições
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    });

    return {
      success: true,
      message: 'Token renovado com sucesso',
      data: {
        access_token: accessToken,
        user: user,
        expires_in: 900,
      },
    };
  }

  @Get('me')
  async getUser(@Request() req: auth.RequestWithUser) {
    return req.user;
  }

  @Patch('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Request() req: auth.RequestWithUser,
    @Body() body: auth.ChangePasswordDto,
  ) {
    const result = await this.authService.changePassword(req.user.id, body);
    return { success: true, ...result };
  }

  @Post('logout')
  async logout(
    @Req() request: express.Request,
    @Res({ passthrough: true }) response: express.Response,
  ) {
    const refreshToken = request.cookies.refreshToken;

    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    // Clear cookie
    response.clearCookie('refreshToken', { path: '/' });

    return {
      success: true,
      message: 'Logout realizado com sucesso',
    };
  }
}
