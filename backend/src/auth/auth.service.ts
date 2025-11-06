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
    const registerRole = data.role ? data.role : 'CUSTOMER';

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

    // Criação do token de acesso
    const payloadAccess = {
      sub: user.id,
      email: user.email
    };

    const accessToken = await this.jwtService.signAsync(payloadAccess, {
      expiresIn: '15m',
      secret: jwtConstants.access,
    });

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
  async refresh(body: { refresh_token: string }) {
    const payload = await this.verifyRefreshToken(body);
    return this.generateToken(payload);
  }
  // Criação do accessToken e do usuário
  async generateToken(payload: any) {
    const accessToken = this.jwtService.sign(
      { email: payload.email },
      {
        secret: jwtConstants.access,
        expiresIn: '15m',
      },
    );
    return { accessToken: accessToken, user: payload };
  }
  // Verificar se o refreshToken é válido
  private async verifyRefreshToken(body: { refresh_token: string }) {
    const refreshToken = body.refresh_token;

    if (!refreshToken) {
      throw new BadRequestException('Bad Request');
    }

    // Verifica a autenticidade do refreshToken e busca o usuário
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: jwtConstants.refresh,
      });
      const user = await this.prismaService.user.findUnique({
        where: { id: payload.id },
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
