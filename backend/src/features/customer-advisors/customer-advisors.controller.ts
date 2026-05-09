import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { CustomerAdvisorsService } from './customer-advisors.service';
import { InviteAdvisorDto } from './dto/invite-advisor.dto';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller()
export class CustomerAdvisorsController {
  constructor(private readonly service: CustomerAdvisorsService) {}

  @Post('customers/me/invite-advisor')
  @Roles(UserRole.CUSTOMER)
  async inviteAdvisor(@Req() req: any, @Body() body: InviteAdvisorDto) {
    const customerId: string = req.user?.sub ?? req.user?.id;
    const result = await this.service.inviteAdvisor(customerId, body.email);
    return { success: true, message: 'Convite enviado com sucesso', data: result };
  }

  @Get('customers/me/advisor')
  @Roles(UserRole.CUSTOMER)
  async getAdvisor(@Req() req: any) {
    const customerId: string = req.user?.sub ?? req.user?.id;
    const advisor = await this.service.getAdvisor(customerId);
    return { success: true, data: advisor };
  }

  @Delete('customers/me/advisor')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.CUSTOMER)
  async removeAdvisor(@Req() req: any) {
    const customerId: string = req.user?.sub ?? req.user?.id;
    const result = await this.service.removeAdvisor(customerId);
    return { success: true, message: 'Assessor removido com sucesso', data: result };
  }

  @Get('advisors/me/clients')
  async getAdvisedClients(@Req() req: any) {
    const advisorId: string = req.user?.sub ?? req.user?.id;
    const clients = await this.service.getAdvisedClients(advisorId);
    return { success: true, data: clients };
  }

  @Post('auth/accept-advisor-invite')
  @HttpCode(HttpStatus.OK)
  async acceptAdvisorInvite(
    @Req() req: any,
    @Body() body: { token: string },
  ) {
    const advisorId: string = req.user?.sub ?? req.user?.id;
    const result = await this.service.acceptInvite(body.token, advisorId);
    return {
      success: true,
      message: result.already_accepted
        ? 'Convite já aceito anteriormente'
        : 'Convite aceito com sucesso',
      data: result,
    };
  }
}
