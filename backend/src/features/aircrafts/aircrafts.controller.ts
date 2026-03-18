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
import { AircraftsService } from './aircrafts.service';
import { CreateAircraftDto } from './dto/create-aircraft.dto';
import { UpdateAircraftDto } from './dto/update-aircraft.dto';
import { PaginationDto } from 'src/shared/dto/pagination.dto';
import { FiltersAircraftMeta } from 'src/shared/dto/filters.dto';
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

@Controller('aircrafts')
export class AircraftsController {
  constructor(
    private readonly aircraftsService: AircraftsService,
    private readonly xlsxImportService: XlsxImportService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SPECIALIST)
  create(
    @Body() createAircraftDto: CreateAircraftDto,
    @CurrentUser() user: UserEntity,
  ) {
    assertSpecialistCanCreate('AIRCRAFT', user);
    createAircraftDto.specialist_id = user.id;
    return this.aircraftsService.create(createAircraftDto);
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
    assertSpecialistCanCreate('AIRCRAFT', user);

    if (!file) {
      throw new BadRequestException('Arquivo XLSX é obrigatório.');
    }

    return this.aircraftsService.importFromXlsx(file.buffer, user);
  }

  @Get('xlsx-template')
  async getXlsxTemplate(@Res({ passthrough: true }) res: any) {
    const buffer = await this.aircraftsService.getXlsxTemplate();
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=template_aeronaves.xlsx',
    });
    return new StreamableFile(buffer);
  }

  @Get()
  @Public()
  async getAllAircrafts(@Query() query: any) {
    //Tratamento das variáveis recebidas do front
    let { page, perPage, ...rawFilters } = query;
    page = Number(page);
    perPage = Number(perPage);

    const appliedFilters: FiltersAircraftMeta = rawFilters;

    // Chama o serviço para obter os dados
    const {
      data,
      count,
      filters = {},
    } = await this.aircraftsService.getAllAircrafts({
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
      message: 'Aeronaves listados com sucesso',
      data: data,
      meta: {
        pagination: pagination,
        filters: {
          total_without_filters: count,
          applied_filters: filters,
        },
      },
    };
  }

  @Get(':id')
  @Public()
  findOne(@Param('id') id: string) {
    return this.aircraftsService.findOne(+id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SPECIALIST)
  update(
    @Param('id') id: string,
    @Body() updateAircraftDto: UpdateAircraftDto,
    @CurrentUser() user: UserEntity,
  ) {
    assertSpecialistCanModify('AIRCRAFT', user);
    return this.aircraftsService.update(+id, updateAircraftDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SPECIALIST)
  remove(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    assertSpecialistCanModify('AIRCRAFT', user);
    return this.aircraftsService.remove(+id);
  }
}
