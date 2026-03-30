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
  assertSpecialistCanCreate,
  assertSpecialistCanModify,
} from 'src/shared/helpers/specialist-auth.helper';
import { Public } from 'src/shared/decorators/public.decorator';
import { ProductImportJobsService } from '../product-import-jobs/product-import-jobs.service';

@Controller('cars')
export class CarsController {
  constructor(
    private readonly carsService: CarsService,
    private readonly productImportJobsService: ProductImportJobsService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SPECIALIST)
  create(@Body() createCarDto: CreateCarDto, @CurrentUser() user: UserEntity) {
    assertSpecialistCanCreate('CAR', user);
    createCarDto.specialist_id = user.id;
    return this.carsService.create(createCarDto);
  }

  @Post('import-csv')
  @Roles(UserRole.ADMIN, UserRole.SPECIALIST)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }),
  )
  async importCsv(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: UserEntity,
  ) {
    assertSpecialistCanCreate('CAR', user);

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
      sucess: true,
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

  @Get(':id')
  @Public()
  findOne(@Param('id') id: number) {
    return this.carsService.findOne(+id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SPECIALIST)
  update(
    @Param('id') id: number,
    @Body() updateCarDto: UpdateCarDto,
    @CurrentUser() user: UserEntity,
  ) {
    if (updateCarDto.specialist_id) {
      delete updateCarDto.specialist_id;
    }

    assertSpecialistCanModify('CAR', user);
    return this.carsService.update(+id, updateCarDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SPECIALIST)
  remove(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    assertSpecialistCanModify('CAR', user);
    return this.carsService.remove(+id);
  }
}
