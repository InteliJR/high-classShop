import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/auth';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login( @Body() body: LoginDto ) {
      console.log( {body} )
      const retorno = await this.authService.login(body);

      console.log(retorno);
  }
}
