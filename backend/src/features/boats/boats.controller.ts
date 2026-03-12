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

@Controller('boats')
export class BoatsController {
  constructor(
    private readonly boatsService: BoatsService,
    private readonly xlsxImportService: XlsxImportService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SPECIALIST)
  create(
    @Body() createBoatDto: CreateBoatDto,
    @CurrentUser() user: UserEntity,
  ) {
    assertSpecialistCanCreate('BOAT', user);
    createBoatDto.specialist_id = user.id;
    return this.boatsService.create(createBoatDto);
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
    assertSpecialistCanCreate('BOAT', user);

    if (!file) {
      throw new BadRequestException('Arquivo XLSX é obrigatório.');
    }

    return this.boatsService.importFromXlsx(file.buffer, user);
  }

  @Get('xlsx-template')
  async getXlsxTemplate(@Res({ passthrough: true }) res: any) {
    const buffer = await this.boatsService.getXlsxTemplate();
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=template_lanchas.xlsx',
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
      sucess: true,
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

  @Get(':id')
  @Public()
  findOne(@Param('id') id: string) {
    return this.boatsService.findOne(+id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SPECIALIST)
  update(
    @Param('id') id: string,
    @Body() updateBoatDto: UpdateBoatDto,
    @CurrentUser() user: UserEntity,
  ) {
    assertSpecialistCanModify('BOAT', user);
    return this.boatsService.update(+id, updateBoatDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SPECIALIST)
  remove(@Param('id') id: string, @CurrentUser() user: UserEntity) {
    assertSpecialistCanModify('BOAT', user);
    return this.boatsService.remove(+id);
  }
}
