import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ApiResponseDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterConsultantDto,
  RegisterOfficeDto,
  RegisterSpecialistDto,
  ResetPasswordDto,
  UserRegisterDto,
} from './dto/auth';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { jwtConstants } from './constants';
import { UserEntity } from './entities/user.entity';
import { UserRole } from '@prisma/client';
import { NotificationService } from 'src/features/notifications/notification.service';
import { S3Service } from 'src/aws/s3.service';
import { resolveCompanyLogoUrl } from './utils/company-logo.util';

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private jwtService: JwtService,
    private readonly notificationService: NotificationService,
    private readonly s3Service: S3Service,
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
    const registerRole = UserRole.CUSTOMER;

    // Separação da req
    const { password, ...dataSave } = data;

    // Criar o hash da senha
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Cria o usuário
    const user = await this.prismaService.user.create({
      data: { ...dataSave, password_hash: passwordHash, role: registerRole },
    });

    this.queueWelcomeEmail(user);

    return {
      user: UserEntity.fromPrisma(user),
    };
  }

  async validateReferralToken(token: string) {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.getJwtSecret('JWT_SECRET_REFERRAL'),
      });

      // Buscar o consultor para retornar o nome completo
      const consultant = await this.prismaService.user.findUnique({
        where: { id: payload.consultantId },
        select: { name: true, surname: true },
      });

      if (!consultant) {
        throw new BadRequestException('Consultor não encontrado');
      }

      // Verificar se já existe um usuário com este email
      const existingUser = await this.prismaService.user.findUnique({
        where: { email: payload.email },
      });

      if (existingUser) {
        throw new BadRequestException(
          'Já existe uma conta cadastrada com este email. Faça login para acessar sua conta.',
        );
      }

      return {
        consultantId: payload.consultantId,
        email: payload.email,
        consultantName: `${consultant.name} ${consultant.surname}`,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new UnauthorizedException('Token de convite inválido ou expirado');
    }
  }

  async login(data: LoginDto) {
    // Procurar o usuário pelo e-mail
    const user = await this.prismaService.user.findFirst({
      where: {
        email: {
          equals: data.email,
          mode: 'insensitive',
        },
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

    // Bloqueio de conta desativada (consultor removido pelo OFFICE/ADMIN)
    if (user.is_active === false) {
      throw new UnauthorizedException(
        'Conta desativada. Contate o escritório.',
      );
    }

    // Criação do token de acesss
    const accessToken = await this.generateAccessToken(user);

    // Criação do refresh token com rotation
    const refreshToken = await this.createRefreshToken(user.id);
    const userWithBranding = await this.getUserWithBranding(user.id);

    return {
      accessToken,
      refreshToken,
      user: UserEntity.fromPrisma(userWithBranding),
    };
  }

  //Criação do accessToken a partir do refreshToken
  async refresh(
    refresh_token: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: UserEntity }> {
    const user = await this.verifyRefreshToken(refresh_token);

    // Invalidate old refresh token (ignore if already deleted - race condition)
    try {
      await this.prismaService.refreshToken.delete({
        where: { token: refresh_token },
      });
    } catch (error) {
      // Token já foi deletado por outra requisição - não é um erro crítico
      if (error.code !== 'P2025') {
        throw error;
      }
    }

    // Create new refresh token (rotation)
    const newRefreshToken = await this.createRefreshToken(user.id);
    const accessToken = await this.generateAccessToken(user);
    const userWithBranding = await this.getUserWithBranding(user.id);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: UserEntity.fromPrisma(userWithBranding),
    };
  }

  // Criar refresh token e salvar no banco
  private async createRefreshToken(userId: string): Promise<string> {
    // Gerar um ID único para garantir que tokens sejam diferentes mesmo em milissegundos consecutivos
    const jti = crypto.randomUUID();

    const payloadRefresh = {
      sub: userId,
      jti, // JWT ID único
    };

    const refreshToken = await this.jwtService.signAsync(payloadRefresh, {
      expiresIn: '7d',
      secret: this.getJwtSecret('JWT_SECRET_REFRESH'),
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

  private async getUserWithBranding(userId: string) {
    const user = await this.prismaService.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            logo: true,
            color_identity: true,
          },
        },
        consultant: {
          select: {
            id: true,
            company: {
              select: {
                id: true,
                name: true,
                logo: true,
                color_identity: true,
              },
            },
          },
        },
      },
    });

    const [companyLogoUrl, consultantCompanyLogoUrl] = await Promise.all([
      resolveCompanyLogoUrl(this.s3Service, user.company?.logo ?? null),
      resolveCompanyLogoUrl(
        this.s3Service,
        user.consultant?.company?.logo ?? null,
      ),
    ]);

    return {
      ...user,
      company: user.company
        ? { ...user.company, logoUrl: companyLogoUrl }
        : user.company,
      consultant: user.consultant
        ? {
            ...user.consultant,
            company: user.consultant.company
              ? {
                  ...user.consultant.company,
                  logoUrl: consultantCompanyLogoUrl,
                }
              : user.consultant.company,
          }
        : user.consultant,
    };
  }

  // Criação do accessToken e do usuário
  async generateAccessToken(user: UserEntity) {
    const accessToken = this.jwtService.signAsync(
      { sub: user.id, email: user.email },
      {
        secret: this.getJwtSecret('JWT_SECRET_ACCESS'),
        expiresIn: '15m',
      },
    );

    return accessToken;
  }

  // Verificar se o refreshToken é válido
  private async verifyRefreshToken(refresh_token: string) {
    const refreshToken = refresh_token;

    if (!refreshToken) {
      throw new UnauthorizedException('Unauthorized');
    }

    // Verifica a autenticidade do refreshToken e busca o usuário
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.getJwtSecret('JWT_SECRET_REFRESH'),
      });

      // Verificar se o token existe no banco
      const tokenRecord = await this.prismaService.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: true },
      });

      if (!tokenRecord) {
        // ponytail: grace window de 30s — token recém-rotacionado por outra aba/request
        // JWT ainda é válido, então payload.sub é confiável
        const graceCutoff = new Date(Date.now() - 30_000);
        const recentToken = await this.prismaService.refreshToken.findFirst({
          where: {
            user_id: payload.sub,
            expires_at: { gt: new Date() },
            created_at: { gt: graceCutoff },
          },
        });
        if (!recentToken) {
          throw new UnauthorizedException('Invalid refresh token');
        }
        // Outra aba já rotacionou — retorna o usuário para o caller emitir novo access token
        const graceUser = await this.prismaService.user.findUnique({
          where: { id: payload.sub },
        });
        if (!graceUser) throw new UnauthorizedException('Unauthorized');
        return graceUser;
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

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.prismaService.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const passwordMatch = await bcrypt.compare(
      dto.current_password,
      user.password_hash,
    );
    if (!passwordMatch) {
      throw new UnauthorizedException('Senha atual incorreta');
    }

    const hashedPassword = await bcrypt.hash(dto.new_password, 10);
    await this.prismaService.user.update({
      where: { id: userId },
      data: { password_hash: hashedPassword },
    });

    return { message: 'Senha alterada com sucesso' };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.prismaService.user.findFirst({
      where: {
        email: {
          equals: dto.email.trim(),
          mode: 'insensitive',
        },
      },
    });

    if (!user) {
      return;
    }

    const token = await this.generatePasswordResetToken(user.id);

    this.queuePasswordResetEmail({
      email: user.email,
      name: [user.name, user.surname].filter(Boolean).join(' '),
      resetToken: token,
      expiresInMinutes: 15,
    });
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    if (dto.new_password !== dto.confirm_password) {
      throw new BadRequestException('As senhas não coincidem');
    }

    const payload = this.verifyPasswordResetToken(dto.token);
    const user = await this.prismaService.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const passwordHash = await bcrypt.hash(dto.new_password, 10);
    await this.prismaService.user.update({
      where: { id: user.id },
      data: { password_hash: passwordHash },
    });

    await this.prismaService.refreshToken.deleteMany({
      where: { user_id: user.id },
    });

    return { message: 'Senha redefinida com sucesso' };
  }

  private async generatePasswordResetToken(userId: string): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId, purpose: 'reset' },
      {
        secret: this.getPasswordResetSecret(),
        expiresIn: '15m',
      },
    );
  }

  private verifyPasswordResetToken(token: string): any {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.getPasswordResetSecret(),
      });

      if (payload.purpose !== 'reset') {
        throw new UnauthorizedException('Token de redefinição inválido');
      }

      return payload;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token expirado ou inválido');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Token inválido');
      }
      throw new UnauthorizedException('Token inválido ou expirado');
    }
  }

  private getPasswordResetSecret(): string {
    const secret =
      process.env.JWT_SECRET_PASSWORD_RESET ||
      process.env.JWT_SECRET_REFERRAL ||
      jwtConstants.passwordReset;

    if (!secret) {
      throw new Error('JWT password reset secret not configured');
    }

    return secret;
  }

  private getJwtSecret(envName: string): string {
    const secret = process.env[envName];

    if (!secret) {
      throw new Error(`${envName} is not configured`);
    }

    return secret;
  }

  async validateConsultantInviteToken(token: string) {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.getJwtSecret('JWT_SECRET_REFERRAL'),
      });

      if (payload.type !== 'CONSULTANT_INVITE') {
        throw new UnauthorizedException('Token inválido');
      }

      const company = await this.prismaService.company.findUnique({
        where: { id: payload.companyId },
        select: { id: true, name: true },
      });

      if (!company) {
        throw new BadRequestException('Escritório não encontrado');
      }

      const existingUser = await this.prismaService.user.findUnique({
        where: { email: payload.email },
      });

      if (existingUser) {
        throw new BadRequestException(
          'Já existe uma conta cadastrada com este email. Faça login para acessar sua conta.',
        );
      }

      return {
        companyId: payload.companyId,
        companyName: company.name,
        email: payload.email,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new UnauthorizedException('Token de convite inválido ou expirado');
    }
  }

  async registerConsultant(dto: RegisterConsultantDto) {
    const { invite_token, password, ...rest } = dto;

    const { companyId, email } =
      await this.validateConsultantInviteToken(invite_token);

    const existingByCpf = await this.prismaService.user.findUnique({
      where: { cpf: rest.cpf },
    });
    if (existingByCpf)
      throw new UnauthorizedException(
        'Já existe uma conta cadastrada com este CPF',
      );

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await this.prismaService.user.create({
      data: {
        ...rest,
        email,
        password_hash: passwordHash,
        role: UserRole.CONSULTANT,
        company_id: companyId,
      },
    });

    this.queueWelcomeEmail(user);

    return { user: UserEntity.fromPrisma(user) };
  }

  async validateSpecialistInviteToken(token: string) {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.getJwtSecret('JWT_SECRET_REFERRAL'),
      });

      if (payload.type !== 'SPECIALIST_INVITE') {
        throw new UnauthorizedException('Token inválido');
      }

      const existingUser = await this.prismaService.user.findUnique({
        where: { email: payload.email },
      });

      if (existingUser) {
        throw new BadRequestException(
          'Já existe uma conta cadastrada com este email. Faça login para acessar sua conta.',
        );
      }

      return {
        email: payload.email,
        speciality: payload.speciality as 'CAR' | 'BOAT' | 'AIRCRAFT',
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new UnauthorizedException('Token de convite inválido ou expirado');
    }
  }

  async registerSpecialist(dto: RegisterSpecialistDto) {
    const { invite_token, password, cnpj, ...rest } = dto;

    const { email, speciality } =
      await this.validateSpecialistInviteToken(invite_token);

    const existingByCnpj = await this.prismaService.user.findUnique({
      where: { cpf: cnpj },
    });
    if (existingByCnpj)
      throw new UnauthorizedException(
        'Já existe uma conta cadastrada com este CNPJ',
      );

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await this.prismaService.user.create({
      data: {
        ...rest,
        cpf: cnpj,
        email,
        password_hash: passwordHash,
        role: UserRole.SPECIALIST,
        speciality,
      },
    });

    this.queueWelcomeEmail(user);

    return { user: UserEntity.fromPrisma(user) };
  }

  private queueWelcomeEmail(user: {
    email: string;
    name: string;
    surname?: string | null;
    role: UserRole;
  }): void {
    setImmediate(() => {
      this.notificationService
        .sendWelcomeEmail({
          email: user.email,
          name: user.name,
          surname: user.surname,
          role: user.role,
        })
        .catch(() => {});
    });
  }

  private queuePasswordResetEmail(data: {
    email: string;
    name: string;
    resetToken: string;
    expiresInMinutes: number;
  }): void {
    setImmediate(() => {
      this.notificationService.sendPasswordResetEmail(data).catch(() => {});
    });
  }

  // ─── OFFICE (gerente do escritório) ────────────────────────────────────
  async validateOfficeInviteToken(token: string) {
    try {
      const payload = this.jwtService.verify(token, {
        secret: jwtConstants.referral,
      });

      if (payload.type !== 'OFFICE_INVITE') {
        throw new UnauthorizedException('Token inválido');
      }

      const company = await this.prismaService.company.findUnique({
        where: { id: payload.companyId },
        select: { id: true, name: true },
      });
      if (!company) throw new BadRequestException('Escritório não encontrado');

      // Garante 1 OFFICE por Company
      const existingOffice = await this.prismaService.user.findFirst({
        where: { company_id: company.id, role: UserRole.OFFICE },
        select: { id: true },
      });
      if (existingOffice) {
        throw new BadRequestException(
          'Este escritório já possui um gerente cadastrado',
        );
      }

      const existingUser = await this.prismaService.user.findUnique({
        where: { email: payload.email },
      });
      if (existingUser) {
        throw new BadRequestException(
          'Já existe uma conta cadastrada com este email. Faça login para acessar sua conta.',
        );
      }

      return {
        companyId: payload.companyId,
        companyName: company.name,
        email: payload.email,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Token de convite inválido ou expirado');
    }
  }

  async registerOffice(dto: RegisterOfficeDto) {
    const { invite_token, password, ...rest } = dto;

    const { companyId, email } =
      await this.validateOfficeInviteToken(invite_token);

    const existingByCpf = await this.prismaService.user.findUnique({
      where: { cpf: rest.cpf },
    });
    if (existingByCpf)
      throw new UnauthorizedException(
        'Já existe uma conta cadastrada com este CPF',
      );

    const passwordHash = await bcrypt.hash(password, 10);

    try {
      const user = await this.prismaService.user.create({
        data: {
          ...rest,
          email,
          password_hash: passwordHash,
          role: UserRole.OFFICE,
          company_id: companyId,
        },
      });
      return { user: UserEntity.fromPrisma(user) };
    } catch (e: any) {
      // Race: outro OFFICE foi criado em paralelo (índice parcial único 1 OFFICE/Company)
      if (e?.code === 'P2002') {
        throw new BadRequestException(
          'Este escritório já possui um gerente cadastrado',
        );
      }
      throw e;
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
