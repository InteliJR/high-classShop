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
import { CarsService } from './cars.service';
import { CreateCarDto } from './dto/create-car.dto';
import { UpdateCarDto } from './dto/update-car.dto';
import { PaginationDto } from 'src/shared/dto/pagination.dto';
import { FiltersCarMeta } from 'src/shared/dto/filters.dto';
import { Roles } from 'src/shared/decorators/roles.decorator';
import { ProductType, UserRole } from '@prisma/client';
import { CurrentUser } from 'src/shared/decorators/current-user.decorator';
import { UserEntity } from 'src/auth/entities/user.entity';
import {
  assertNoProductOwnerMutation,
} from 'src/shared/helpers/specialist-auth.helper';
import { Public } from 'src/shared/decorators/public.decorator';
import { ProductImportJobsService } from '../product-import-jobs/product-import-jobs.service';
import { ActorContextService } from 'src/shared/actor-context/actor-context.service';
import { DelegatedActionAuditService } from 'src/shared/actor-context/delegated-action-audit.service';

@Controller('cars')
export class CarsController {
  constructor(
    private readonly carsService: CarsService,
    private readonly productImportJobsService: ProductImportJobsService,
    private readonly actorContextService: ActorContextService,
    private readonly delegatedAudit: DelegatedActionAuditService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SPECIALIST)
  async create(
    @Body() createCarDto: CreateCarDto,
    @CurrentUser() user: UserEntity,
  ) {
    const context = await this.actorContextService.resolve(
      user,
      createCarDto.specialist_id,
      ProductType.CAR,
    );
    createCarDto.specialist_id = context.specialistId;
    const car = await this.carsService.create(createCarDto);
    await this.delegatedAudit.record({
      context,
      action: 'PRODUCT_CREATE',
      resourceType: 'CAR',
      resourceId: car!.id,
    });
    return car;
  }

  @Post('import-csv/preview')
  @Roles(UserRole.ADMIN, UserRole.SPECIALIST)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }),
  )
  async previewCsvImport(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: UserEntity,
    @Body('specialist_id') targetSpecialistId?: string,
    @Body('mode') mode: 'ADDITIVE' | 'SYNCHRONIZE' = 'ADDITIVE',
  ) {
    const context = await this.actorContextService.resolve(
      user,
      targetSpecialistId,
      ProductType.CAR,
    );
    if (!file?.originalname?.toLowerCase().endsWith('.csv')) {
      throw new BadRequestException('Arquivo CSV é obrigatório.');
    }
    return this.productImportJobsService.previewCsvImport(
      file.buffer,
      ProductType.CAR,
      context.specialistId,
      mode,
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
    @Body('specialist_id') targetSpecialistId?: string,
    @Body('mode') mode: 'ADDITIVE' | 'SYNCHRONIZE' = 'ADDITIVE',
    @Body('confirm_synchronize') confirmSynchronize = false,
  ) {
    const context = await this.actorContextService.resolve(
      user,
      targetSpecialistId,
      ProductType.CAR,
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
      ProductType.CAR,
      { context, mode, confirmSynchronize },
    );
  }

  @Get('csv-template')
  async getCsvTemplate(@Res({ passthrough: true }) res: any) {
    const buffer = await this.carsService.getCsvTemplate();
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename=template_carros.csv',
    });
    return new StreamableFile(buffer);
  }

  @Get()
  @Public()
  async getAllCars(@Query() query: any) {
    // Extrai paginação e considera o restante como filtros
    let { page, perPage, ...rawFilters } = query;
    page = Number(page);
    perPage = Number(perPage);

    const appliedFilters: FiltersCarMeta = rawFilters;

    // Chama o serviço para obter os dados
    const {
      data,
      count,
      filters = {},
    } = await this.carsService.getAllCars({
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
      message: 'Carros listados com sucesso',
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
  async getAllCarsForAdmin(
    @Query() query: any,
    @CurrentUser() user: UserEntity,
  ) {
    let { page, perPage, target_specialist_id, ...rawFilters } = query;
    page = Number(page) || 1;
    perPage = Number(perPage) || 20;
    const context = await this.actorContextService.resolve(
      user,
      target_specialist_id,
      ProductType.CAR,
    );
    rawFilters.specialist_id = context.specialistId;
    const { data, count, filters = {} } = await this.carsService.getAllCars(
      { page, perPage, appliedFilters: rawFilters },
      true,
    );
    const skip = (page - 1) * perPage;
    return {
      success: true,
      message: 'Catálogo administrativo de carros listado com sucesso',
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
    return this.carsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SPECIALIST)
  async update(
    @Param('id') id: string,
    @Body() updateCarDto: UpdateCarDto,
    @CurrentUser() user: UserEntity,
    @Query('target_specialist_id') targetSpecialistId?: string,
  ) {
    assertNoProductOwnerMutation(updateCarDto as Record<string, unknown>);
    const context = await this.actorContextService.resolve(
      user,
      targetSpecialistId,
      ProductType.CAR,
    );
    const existing = await this.carsService.findOne(id);
    this.actorContextService.assertResourceSpecialist(
      context,
      existing?.specialist_id,
    );
    const car = await this.carsService.update(id, updateCarDto);
    await this.delegatedAudit.record({
      context,
      action: 'PRODUCT_UPDATE',
      resourceType: 'CAR',
      resourceId: id,
    });
    return car;
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
      ProductType.CAR,
    );
    const existing = await this.carsService.findOne(id);
    this.actorContextService.assertResourceSpecialist(
      context,
      existing?.specialist_id,
    );
    const result = await this.carsService.remove(id);
    await this.delegatedAudit.record({
      context,
      action: 'PRODUCT_DEACTIVATE',
      resourceType: 'CAR',
      resourceId: id,
    });
    return result;
  }
}
