import { Controller, Get } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { CommissionsService } from './commissions.service';

@Controller('commissions')
export class CommissionsController {
  constructor(private readonly commissionsService: CommissionsService) {}

  // Fluxo de comissão por venda — visão consolidada do ADMIN.
  @Get('sales')
  @Roles(UserRole.ADMIN)
  listSales() {
    return this.commissionsService.listSales();
  }
}
