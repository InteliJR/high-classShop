import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BoatsService } from './boats.service';
import { CreateBoatDto } from './dto/create-boat.dto';
import { UpdateBoatDto } from './dto/update-boat.dto';
import { PaginationDto } from 'src/shared/dto/pagination.dto';
import { FiltersBoatMeta } from 'src/shared/dto/filters.dto';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { ProductType, UserRole } from '@prisma/client';
import { CurrentUser } from 'src/shared/decorators/current-user.decorator';
import { UserEntity } from 'src/auth/entities/user.entity';
import {
  assertSpecialistCanCreate,
  assertSpecialistCanModify,
  assertNoProductOwnerMutation,
  assertSpecialistOwnsProduct,
} from 'src/shared/helpers/specialist-auth.helper';
import { Public } from 'src/shared/decorators/public.decorator';
import { ProductImportJobsService } from '../product-import-jobs/product-import-jobs.service';
import { ActorContextService } from 'src/shared/actor-context/actor-context.service';
import { DelegatedActionAuditService } from 'src/shared/actor-context/delegated-action-audit.service';
import { ProductCsvImportDto } from '../product-import-jobs/dto/product-csv-import.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { randomUUID } from 'node:crypto';

@Controller('boats')
export class BoatsController {
  constructor(
    private readonly boatsService: BoatsService,
    private readonly productImportJobsService: ProductImportJobsService,
    private readonly actorContextService: ActorContextService,
    private readonly delegatedAudit: DelegatedActionAuditService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SPECIALIST)
  async create(
    @Body() createBoatDto: CreateBoatDto,
    @CurrentUser() user: UserEntity,
  ) {
    const context = await this.actorContextService.resolve(
      user,
      createBoatDto.specialist_id,
      ProductType.BOAT,
    );
    createBoatDto.specialist_id = context.specialistId;
    const productId = randomUUID();
    const preparedImages = await this.boatsService.prepareProductImages(
      productId,
      createBoatDto.images,
    );
    try {
      return await this.prisma.$transaction(async (tx) => {
        const boat = await this.boatsService.create(createBoatDto, tx, {
          productId,
          images: preparedImages,
        });
        await this.delegatedAudit.record(
          {
            context,
            action: 'PRODUCT_CREATE',
            resourceType: 'BOAT',
            resourceId: boat.id,
          },
          tx,
        );
        return boat;
      });
    } catch (error) {
      await this.boatsService.cleanupPreparedImages(preparedImages);
      throw error;
    }
  }

  @Post('import-csv/preview')
  @Roles(UserRole.ADMIN, UserRole.SPECIALIST)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }),
  )
  async previewCsvImport(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: UserEntity,
    @Body() options: ProductCsvImportDto = new ProductCsvImportDto(),
  ) {
    const context = await this.actorContextService.resolve(
      user,
      options.specialist_id,
      ProductType.BOAT,
    );
    if (!file?.originalname?.toLowerCase().endsWith('.csv')) {
      throw new BadRequestException('Arquivo CSV é obrigatório.');
    }
    return this.productImportJobsService.previewCsvImport(
      file.buffer,
      ProductType.BOAT,
      context.specialistId,
      options.mode,
    );
  }

  @Post('import-csv')
  @Roles(UserRole.ADMIN, UserRole.SPECIALIST)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }),
  )
  async importCsv(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: UserEntity,
    @Body() options: ProductCsvImportDto = new ProductCsvImportDto(),
  ) {
    const context = await this.actorContextService.resolve(
      user,
      options.specialist_id,
      ProductType.BOAT,
    );

    if (!file) {
      throw new BadRequestException('Arquivo CSV é obrigatório.');
    }

    const isCsvFile =
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname?.toLowerCase().endsWith('.csv');

    if (!isCsvFile) {
      throw new BadRequestException('Apenas arquivos .csv são aceitos.');
    }

    return this.productImportJobsService.createJobFromCsv(
      file.buffer,
      user,
      ProductType.BOAT,
      {
        context,
        mode: options.mode,
        confirmSynchronize: options.confirm_synchronize,
        synchronizePreviewToken: options.synchronize_preview_token,
      },
    );
  }

  @Get('csv-template')
  async getCsvTemplate(@Res({ passthrough: true }) res: any) {
    const buffer = await this.boatsService.getCsvTemplate();
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename=template_lanchas.csv',
    });
    return new StreamableFile(buffer);
  }

  @Get()
  @Public()
  async getAllBoats(@Query() query: any) {
    // Tratamento das varíaveis recebidas do front
    let { page, perPage, ...rawFilters } = query;
    page = Number(page);
    perPage = Number(perPage);

    const appliedFilters: FiltersBoatMeta = rawFilters;

    // Chama o serviço para obter os dados
    const {
      data,
      count,
      filters = {},
    } = await this.boatsService.getAllBoats({
      page,
      perPage,
      appliedFilters,
    });

    // Cálculo dos elementos já visualizados
    const skip = (page - 1) * perPage;

    // Atualiza os metadados de paginação
    const pagination = new PaginationDto();
    pagination.current_page = page;
    pagination.total_pages = count / perPage;
    pagination.has_next = skip + perPage < count;
    pagination.has_prev = skip > 0;
    pagination.total = count;
    pagination.per_page = perPage;

    return {
      success: true,
      message: 'Barcos listados com sucesso',
      data: data,
      meta: {
        pagination: pagination,
        filters: {
          applied_filters: filters,
          total_without_filters: count,
        },
      },
    };
  }

  @Get('admin/all')
  @Roles(UserRole.ADMIN)
  async getAllBoatsForAdmin(
    @Query() query: any,
    @CurrentUser() user: UserEntity,
  ) {
    let { page, perPage, target_specialist_id, ...rawFilters } = query;
    page = Number(page) || 1;
    perPage = Number(perPage) || 20;
    const context = await this.actorContextService.resolve(
      user,
      target_specialist_id,
      ProductType.BOAT,
    );
    rawFilters.specialist_id = context.specialistId;
    const { data, count, filters = {} } = await this.boatsService.getAllBoats(
      { page, perPage, appliedFilters: rawFilters },
      true,
    );
    const skip = (page - 1) * perPage;
    return {
      success: true,
      message: 'Catálogo administrativo de lanchas listado com sucesso',
      data,
      meta: {
        pagination: {
          current_page: page,
          total_pages: Math.ceil(count / perPage),
          has_next: skip + perPage < count,
          has_prev: skip > 0,
          total: count,
          per_page: perPage,
        },
        filters: { applied_filters: filters, total_without_filters: count },
      },
    };
  }

  @Get(':id')
  @Public()
  findOne(@Param('id') id: string) {
    return this.boatsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SPECIALIST)
  async update(
    @Param('id') id: string,
    @Body() updateBoatDto: UpdateBoatDto,
    @CurrentUser() user: UserEntity,
    @Query('target_specialist_id') targetSpecialistId?: string,
  ) {
    assertNoProductOwnerMutation(updateBoatDto as Record<string, unknown>);
    const context = await this.actorContextService.resolve(
      user,
      targetSpecialistId,
      ProductType.BOAT,
    );
    const existing = await this.boatsService.findOne(id);
    this.actorContextService.assertResourceSpecialist(
      context,
      existing?.specialist_id,
    );
    const preparedImages = await this.boatsService.prepareProductImages(
      id,
      updateBoatDto.images,
    );
    try {
      return await this.prisma.$transaction(async (tx) => {
        const boat = await this.boatsService.update(id, updateBoatDto, tx, {
          images: preparedImages,
        });
        await this.delegatedAudit.record(
          {
            context,
            action: 'PRODUCT_UPDATE',
            resourceType: 'BOAT',
            resourceId: id,
          },
          tx,
        );
        return boat;
      });
    } catch (error) {
      await this.boatsService.cleanupPreparedImages(preparedImages);
      throw error;
    }
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SPECIALIST)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: UserEntity,
    @Query('target_specialist_id') targetSpecialistId?: string,
  ) {
    const context = await this.actorContextService.resolve(
      user,
      targetSpecialistId,
      ProductType.BOAT,
    );
    const existing = await this.boatsService.findOne(id);
    this.actorContextService.assertResourceSpecialist(
      context,
      existing?.specialist_id,
    );
    return this.prisma.$transaction(async (tx) => {
      const result = await this.boatsService.remove(id, tx);
      await this.delegatedAudit.record(
        {
          context,
          action: 'PRODUCT_DEACTIVATE',
          resourceType: 'BOAT',
          resourceId: id,
        },
        tx,
      );
      return result;
    });
  }
}
