import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApiResponseDto, LoginDto } from './dto/auth';
import * as bcrypt from 'bcrypt';
import { jwtConstants } from './constants';

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(data: LoginDto) {
    // Procurar o usuário pelo e-mail
    const user = await this.prismaService.user.findUnique({
      where: {
        email: data.email,
      },
    });

    // Realizar a validação se existe um usuário com o e-mail fornecido
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Realizar a comparação se as senhas são iguais
    const passwordMatch = await bcrypt.compare(
      data.password_hash,
      user.password_hash,
    );
    // Validar se as senhas são parecidas
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Criação do token de acesso
    const payloadAccess = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    const accessToken = await this.jwtService.signAsync(payloadAccess, {
      expiresIn: '15m',
      secret: jwtConstants.access,
    });

    // Criação do refresh token
    const payloadRefresh = {
      id: user.id,
    };
    const refreshToken = await this.jwtService.signAsync(payloadRefresh, {
      expiresIn: '7d',
      secret: jwtConstants.refresh,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
}
