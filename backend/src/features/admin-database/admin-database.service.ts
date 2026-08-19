import { BadRequestException, Injectable } from '@nestjs/common';
import { S3Service } from 'src/aws/s3.service';
import { resolveCompanyLogoUrl } from 'src/auth/utils/company-logo.util';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  Cell,
  ColumnMeta,
  ENTITIES,
  EntityConfig,
} from './admin-database.columns';
import { text } from './admin-database.format';

@Injectable()
export class AdminDatabaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  listEntities() {
    return Object.entries(ENTITIES).map(([key, cfg]) => ({
      key,
      label: cfg.label,
    }));
  }

  async countAll(): Promise<{ key: string; label: string; count: number }[]> {
    return Promise.all(
      Object.entries(ENTITIES).map(async ([key, cfg]) => ({
        key,
        label: cfg.label,
        count: await (this.prisma as any)[cfg.model].count(),
      })),
    );
  }

  async list(
    entity: string,
    page: number,
    pageSize: number,
  ): Promise<{
    columns: ColumnMeta[];
    data: Cell[][];
    rowMeta: ({ id: string; role: string } | { id: string })[];
    total: number;
    page: number;
    pageSize: number;
  }> {
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

    const [rows, total] = await Promise.all([
      model.findMany({
        skip,
        take,
        orderBy: { id: 'desc' },
        select: { ...cfg.select, id: true },
      }),
      model.count(),
    ]);

    // As URLs assinadas do S3 são geradas em paralelo, no máximo `take` (100)
    // por página.
    const data: Cell[][] = await Promise.all(
      rows.map((row: any) => this.buildRow(cfg, row)),
    );

    const columns: ColumnMeta[] = cfg.columns.map((c) => ({
      label: c.label,
      ...(c.wide ? { wide: true } : {}),
    }));
    const rowMeta = rows.map((row: any) =>
      entity === 'users' ? { id: row.id, role: row.role } : { id: row.id },
    );

    return { columns, data, rowMeta, total, page: currentPage, pageSize: take };
  }

  /** Projeta uma linha do Prisma na matriz de células já formatadas. */
  private async buildRow(cfg: EntityConfig, row: any): Promise<Cell[]> {
    return Promise.all(
      cfg.columns.map(async (col): Promise<Cell> => {
        const raw = col.get(row);

        if (col.image) {
          const key = typeof raw === 'string' ? raw : null;
          let url: string | null = null;
          try {
            url = await resolveCompanyLogoUrl(this.s3, key);
          } catch {
            // célula feia (sem logo) é infinitamente melhor que uma página de 500.
          }
          return {
            kind: 'image',
            url,
            alt: col.alt ? col.alt(row) : 'Imagem',
          };
        }

        return (col.format ?? text)(raw);
      }),
    );
  }
}
