import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Isso torna o módulo disponível em toda a aplicação sem precisar importar toda hora
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // Exporta o serviço para que outros módulos o enxerguem
})
export class PrismaModule {}