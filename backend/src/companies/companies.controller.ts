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
import { S3Service } from '../aws/s3.service';

@Controller('companies')
export class CompaniesController {

  constructor(
    private readonly companiesService: CompaniesService,
    private readonly s3Service: S3Service,
  ) {}

  @Get()
  findAll() {
    return this.companiesService.findAll();
  }

  @Post()
  @UseInterceptors(FileInterceptor('logo')) 
  async create(
    @Body() body: { name: string; cnpj: string }, 
    @UploadedFile() file: Express.Multer.File, 
  ) {
    let logoKey: string | undefined = undefined;


    if (file) {

      const uniqueFileName = `logos/${Date.now()}-${file.originalname}`;
      

      logoKey = await this.s3Service.uploadFile(file, uniqueFileName);
    }


    return this.companiesService.create({
      ...body,
      logo: logoKey,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.companiesService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Partial<{ name: string; cnpj: string; logo: string; description: string }>,
  ) {
    return this.companiesService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.companiesService.remove(id);
  }
}