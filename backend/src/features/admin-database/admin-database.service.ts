import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

interface EntityConfig {
  model: string; // nome do delegate no PrismaService (ex: 'user')
  label: string;
  // Quando definido, LIMITA os campos retornados. Usado para NUNCA expor
  // password_hash / tokens. Entidades sem segredo podem omitir (retorna scalars).
  select?: Record<string, boolean>;
}

// Whitelist — só estas entidades são navegáveis pelo admin. Tabelas com
// segredos (CalendlyConnection, CustomerAdvisor.token) ficam de fora de propósito.
const ENTITIES: Record<string, EntityConfig> = {
  users: {
    model: 'user',
    label: 'Usuários',
    // Select explícito: sem password_hash, sem campos sensíveis do Calendly.
    select: {
      id: true,
      name: true,
      surname: true,
      email: true,
      role: true,
      cpf: true,
      rg: true,
      phone: true,
      speciality: true,
      commission_rate: true,
      company_id: true,
      consultant_id: true,
      identification_number: true,
    },
  },
  companies: { model: 'company', label: 'Escritórios' },
  cars: { model: 'car', label: 'Carros' },
  boats: { model: 'boat', label: 'Barcos' },
  aircrafts: { model: 'aircraft', label: 'Aeronaves' },
  processes: { model: 'process', label: 'Processos' },
  contracts: { model: 'contract', label: 'Contratos' },
  proposals: { model: 'negotiationProposal', label: 'Propostas' },
  appointments: { model: 'appointment', label: 'Agendamentos' },
};

@Injectable()
export class AdminDatabaseService {
  constructor(private readonly prisma: PrismaService) {}

  listEntities() {
    return Object.entries(ENTITIES).map(([key, cfg]) => ({
      key,
      label: cfg.label,
    }));
  }

  async list(entity: string, page: number, pageSize: number) {
    const cfg = ENTITIES[entity];
    if (!cfg) {
      throw new BadRequestException(`Entidade inválida: ${entity}`);
    }

    const take = Math.min(Math.max(Math.floor(pageSize), 1), 100);
    const currentPage = Math.max(Math.floor(page), 1);
    const skip = (currentPage - 1) * take;

    // Acesso dinâmico ao delegate — seguro porque `entity` é validado contra a
    // whitelist acima (nunca vem direto do cliente para o Prisma).
    const model = (this.prisma as any)[cfg.model];

    const [data, total] = await Promise.all([
      model.findMany({
        skip,
        take,
        orderBy: { id: 'desc' },
        ...(cfg.select ? { select: cfg.select } : {}),
      }),
      model.count(),
    ]);

    return { data, total, page: currentPage, pageSize: take };
  }
}
