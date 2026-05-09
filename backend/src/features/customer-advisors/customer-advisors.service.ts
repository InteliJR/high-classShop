import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationService } from 'src/features/notifications/notification.service';
import { jwtConstants } from 'src/auth/constants';

@Injectable()
export class CustomerAdvisorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly notificationService: NotificationService,
  ) {}

  async inviteAdvisor(customerId: string, invitedEmail: string) {
    const customer = await this.prisma.user.findUnique({
      where: { id: customerId },
      select: { id: true, name: true, surname: true, email: true },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado');

    // Não convidar a si mesmo
    if (customer.email.toLowerCase() === invitedEmail.toLowerCase()) {
      throw new BadRequestException('Você não pode convidar a si mesmo como assessor');
    }

    // Verificar se já tem assessor ativo (aceito)
    const existing = await this.prisma.customerAdvisor.findUnique({
      where: { customer_id: customerId },
    });
    if (existing?.accepted_at) {
      throw new BadRequestException(
        'Você já possui um assessor ativo. Remova-o antes de convidar outro.',
      );
    }

    const token = await this.jwtService.signAsync(
      { customerId, invitedEmail },
      { secret: jwtConstants.advisor, expiresIn: '7d' },
    );

    const record = await this.prisma.customerAdvisor.upsert({
      where: { customer_id: customerId },
      create: { customer_id: customerId, email: invitedEmail, token },
      update: { email: invitedEmail, token, advisor_id: null, accepted_at: null },
    });

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    const acceptUrl = `${frontendUrl}/advisor/accept?token=${token}`;
    const customerName = `${customer.name} ${customer.surname ?? ''}`.trim();

    setImmediate(() => {
      this.notificationService
        .sendAdvisorInviteEmail({
          advisorEmail: invitedEmail,
          customerName,
          acceptUrl,
        })
        .catch(() => {});
    });

    return { id: record.id, email: record.email, accepted_at: record.accepted_at };
  }

  async getAdvisor(customerId: string) {
    const record = await this.prisma.customerAdvisor.findUnique({
      where: { customer_id: customerId },
      include: {
        advisor: {
          select: { id: true, name: true, surname: true, email: true },
        },
      },
    });
    return record ?? null;
  }

  async removeAdvisor(customerId: string) {
    const record = await this.prisma.customerAdvisor.findUnique({
      where: { customer_id: customerId },
    });
    if (!record) throw new NotFoundException('Nenhum assessor vinculado');

    await this.prisma.customerAdvisor.delete({ where: { customer_id: customerId } });
    return { removed: true };
  }

  async acceptInvite(token: string, advisorId: string) {
    let payload: { customerId: string; invitedEmail: string };
    try {
      payload = this.jwtService.verify(token, { secret: jwtConstants.advisor });
    } catch {
      throw new UnauthorizedException('Link de convite inválido ou expirado');
    }

    const advisor = await this.prisma.user.findUnique({
      where: { id: advisorId },
      select: { id: true, email: true },
    });
    if (!advisor) throw new NotFoundException('Usuário não encontrado');

    if (advisor.email.toLowerCase() !== payload.invitedEmail.toLowerCase()) {
      throw new ForbiddenException(
        'Este convite foi enviado para outro e-mail. Faça login com o e-mail correto.',
      );
    }

    const record = await this.prisma.customerAdvisor.findUnique({
      where: { customer_id: payload.customerId },
    });
    if (!record) throw new NotFoundException('Convite não encontrado ou já cancelado');
    if (record.token !== token) {
      throw new UnauthorizedException('Link de convite inválido ou expirado');
    }
    if (record.accepted_at) {
      return { already_accepted: true };
    }

    const updated = await this.prisma.customerAdvisor.update({
      where: { customer_id: payload.customerId },
      data: { advisor_id: advisorId, accepted_at: new Date() },
    });

    return { accepted: true, customer_id: updated.customer_id };
  }

  async getAdvisedClients(advisorId: string) {
    const records = await this.prisma.customerAdvisor.findMany({
      where: { advisor_id: advisorId, accepted_at: { not: null } },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            surname: true,
            email: true,
            processesAsClient: {
              select: {
                id: true,
                status: true,
                product_type: true,
                created_at: true,
              },
              orderBy: { created_at: 'desc' },
              take: 10,
            },
          },
        },
      },
    });

    return records.map((r) => ({
      relation_id: r.id,
      accepted_at: r.accepted_at,
      customer: r.customer,
    }));
  }
}
