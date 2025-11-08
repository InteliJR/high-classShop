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

    // Criação do refresh token com rotation
    const refreshToken = await this.createRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      user: new UserEntity(user),  
    };
  }

  //Criação do accessToken a partir do refreshToken
  async refresh( refresh_token : string): Promise<{ accessToken: string; refreshToken: string; user: UserEntity }> {
    const user = await this.verifyRefreshToken(refresh_token);
    
    // Invalidate old refresh token
    await this.prismaService.refreshToken.delete({
      where: { token: refresh_token },
    });

    // Create new refresh token (rotation)
    const newRefreshToken = await this.createRefreshToken(user.id);
    const accessToken = await this.generateAccessToken(user);
    
    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: new UserEntity(user),
    };
  }

  // Criar refresh token e salvar no banco
  private async createRefreshToken(userId: string): Promise<string> {
    const payloadRefresh = {
      sub: userId,
    };

    const refreshToken = await this.jwtService.signAsync(payloadRefresh, {
      expiresIn: '7d',
      secret: jwtConstants.refresh,
    });

    // Salvar no banco
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 dias

    await this.prismaService.refreshToken.create({
      data: {
        token: refreshToken,
        user_id: userId,
        expires_at: expiresAt,
      },
    });

    return refreshToken;
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

      // Verificar se o token existe no banco
      const tokenRecord = await this.prismaService.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: true },
      });

      if (!tokenRecord) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Verificar se o token expirou
      if (new Date() > tokenRecord.expires_at) {
        // Remove token expirado
        await this.prismaService.refreshToken.delete({
          where: { token: refreshToken },
        });
        throw new UnauthorizedException('Refresh token expired');
      }

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

  // Logout - remover refresh token do banco
  async logout(refreshToken: string): Promise<void> {
    try {
      await this.prismaService.refreshToken.delete({
        where: { token: refreshToken },
      });
    } catch (error) {
      // Token não encontrado, já foi removido ou inválido - não precisa fazer nada
    }
  }
}
