import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
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
    return await this.authService.register(body);
  }

  @Post('login')
  async login(@Body() body: auth.LoginDto) {
    return await this.authService.login(body);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  async getUser(@Request() req: auth.RequestWithUser) {
    return req.user;
  }
}
