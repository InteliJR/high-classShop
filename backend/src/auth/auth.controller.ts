import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import * as auth from './dto/auth';
import { AuthGuard } from './auth.guard';

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
  async login(@Body() body: auth.LoginDto) {
    const { accessToken, refreshToken, user } =
      await this.authService.login(body);
    return {
      sucess: true,
      message: 'Login realizado com sucesso',
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 900,
        user: user,
      },
    };
  }

  @Post('refresh')
  async refresh(@Body() body: { refresh_token: string }) {
    const {accessToken, user} = await this.authService.refresh(body);
    return {
      success: true,
      message: "Token renovado com sucesso",
      data: {
        access_token: accessToken,
        expires_in: 900,
        user: user,
      }
    }
  }

  @UseGuards(AuthGuard)
  @Get('me')
  async getUser(@Request() req: auth.RequestWithUser) {
    return req.user;
  }
}
