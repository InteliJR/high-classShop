import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import * as auth from './dto/auth';
import { AuthGuard } from './auth.guard';
import express from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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

  @Post('login')
  async login(
    @Body() body: auth.LoginDto,
    @Res({ passthrough: true }) response: express.Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.authService.login(body);
    
    response.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/auth/refresh',
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

  @Post('refresh')
  async refresh(@Body() body: { refresh_token: string }) {
    const { accessToken, user } = await this.authService.refresh(body);
    return {
      success: true,
      message: 'Token renovado com sucesso',
      data: {
        access_token: accessToken,
        expires_in: 900,
        user: user,
      },
    };
  }

  @UseGuards(AuthGuard)
  @Get('me')
  async getUser(@Request() req: auth.RequestWithUser) {
    return req.user;
  }
}
