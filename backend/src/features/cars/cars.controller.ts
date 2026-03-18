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
import { UserRole } from '@prisma/client';
import { CurrentUser } from 'src/shared/decorators/current-user.decorator';
import { UserEntity } from 'src/auth/entities/user.entity';
import {
  assertSpecialistCanCreate,
  assertSpecialistCanModify,
} from 'src/shared/helpers/specialist-auth.helper';
import { XlsxImportService } from 'src/shared/services/xlsx-import.service';
import { ImportResponseDto } from 'src/shared/dto/import-response.dto';
import { Public } from 'src/shared/decorators/public.decorator';

@Controller('cars')
export class CarsController {
  constructor(
    private readonly carsService: CarsService,
    private readonly xlsxImportService: XlsxImportService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SPECIALIST)
  create(@Body() createCarDto: CreateCarDto, @CurrentUser() user: UserEntity) {
    assertSpecialistCanCreate('CAR', user);
    createCarDto.specialist_id = user.id;
    return this.carsService.create(createCarDto);
  }

  @Post('import-xlsx')
  @Roles(UserRole.ADMIN, UserRole.SPECIALIST)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }),
  )
  async importXlsx(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: UserEntity,
  ): Promise<ImportResponseDto> {
    // Validar permissão do usuário
    assertSpecialistCanCreate('CAR', user);

    if (!file) {
      throw new BadRequestException('Arquivo XLSX é obrigatório.');
    }

    return this.carsService.importFromXlsx(file.buffer, user);
  }

  @Get('xlsx-template')
  async getXlsxTemplate(@Res({ passthrough: true }) res: any) {
    const buffer = await this.carsService.getXlsxTemplate();
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=template_carros.xlsx',
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
