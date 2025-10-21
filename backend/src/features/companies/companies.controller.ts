import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CompaniesService } from './companies.service';
import { S3Service } from '../../aws/s3.service';

/**
 * Define a rota base para este controlador.
 * Todas as rotas definidas aqui estarão sob o prefixo '/companies'.
 */
@Controller('companies')
export class CompaniesController {
  /**
   * @param companiesService - O serviço que contém a lógica de negócio para empresas.
   * @param s3Service - O serviço que lida com o upload de ficheiros para o S3.
   */
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly s3Service: S3Service,
  ) {}

  // ROTAS CRUD PARA ESCRITÓRIOS

  // Rota para buscar todos os escritórios.
  @Get()
  findAll() {
    return this.companiesService.findAll();
  }

  // Rota para criar um novo escritório.
  @Post()

  // O FileInterceptor lida com o upload do ficheiro 'logo' na requisição.
  @UseInterceptors(FileInterceptor('logo'))
  async create(
    @Body() body: { name: string; cnpj: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    let logoKey: string | undefined = undefined;

    // Verifica se um ficheiro foi realmente enviado.
    if (file) {
      // 2. Criam um nome de ficheiro único para evitar que um ficheiro sobreponha outro no S3.
      const uniqueFileName = `logos/${Date.now()}-${file.originalname}`;

      // Chama o serviço especializado para fazer o upload do ficheiro para o S3.
      logoKey = await this.s3Service.uploadFile(file, uniqueFileName);
    }

    // Chama o serviço de empresas para criar o registo no banco de dados,
    return this.companiesService.create({
      ...body,
      logo: logoKey,
    });
  }

  // Rota para buscar um único escritório pelo seu ID.
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.companiesService.findOne(id);
  }

  // Rota para atualizar os dados de um escritório.
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: Partial<{
      name: string;
      cnpj: string;
      logo: string;
      description: string;
    }>,
  ) {
    return this.companiesService.update(id, body);
  }

  // Rota para apagar um escritório.
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.companiesService.remove(id);
  }
}
