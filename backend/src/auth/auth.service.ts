import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApiResponseDto, LoginDto, UserRegisterDto } from './dto/auth';
import * as bcrypt from 'bcrypt';
import { jwtConstants } from './constants';
import { UserEntity } from './entities/user.entity';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(data: UserRegisterDto) {
    // Verificar se o usuário já existe
    const userAlreadyExists = await this.prismaService.user.findUnique({
      where: {
        email: data.email,
      },
    });
    if (userAlreadyExists) {
      throw new UnauthorizedException('This user already exists');
    }

    // Criar o role para registrar o usuário padrão
    const registerRole = data.role ?? UserRole.CUSTOMER;

    // Separação da req
    const { password, ...dataSave } = data;

    // Criar o hash da senha
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Cria o usuário
    const user = await this.prismaService.user.create({
      data: { ...dataSave, password_hash: passwordHash, role: registerRole },
    });

    return {
      user: user,
    };
  }

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
      data.password,
      user.password_hash,
    );
    // Validar se as senhas são parecidas
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Criação do token de acesss
    const accessToken = await this.generateAccessToken(user);

    // Criação do refresh token
    const payloadRefresh = {
      sub: user.id,
    };

    const refreshToken = await this.jwtService.signAsync(payloadRefresh, {
      expiresIn: '7d',
      secret: jwtConstants.refresh,
    });

    return {
      accessToken,
      refreshToken,
      user: new UserEntity(user),  
    };
  }

  //Criação do accessToken a partir do refreshToken
  async refresh( refresh_token : string): Promise<{ accessToken: string; user: UserEntity }> {
    const user = await this.verifyRefreshToken(refresh_token);
    const accessToken = await this.generateAccessToken(user);
    return {
      accessToken,
      user: new UserEntity(user),
    };
  }

  // Criação do accessToken e do usuário
  async generateAccessToken(user: UserEntity) {
    const accessToken = this.jwtService.signAsync(
      { sub: user.id , email: user.email },
      {
        secret: jwtConstants.access,
        expiresIn: '15m',
      },
    );

    return accessToken;
  }

  // Verificar se o refreshToken é válido
  private async verifyRefreshToken(refresh_token : string) {
    const refreshToken = refresh_token;

    if (!refreshToken) {
       throw new UnauthorizedException('Unauthorized');
     }

    // Verifica a autenticidade do refreshToken e busca o usuário
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: jwtConstants.refresh,
      });

      const user = await this.prismaService.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new NotFoundException('Not found');
      }

      return user;
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Unauthorized');
      }
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Unauthorized');
      }
      throw new UnauthorizedException(error.name);
    }
  }
}
