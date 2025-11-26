import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { ProcessesService } from './processes.service';
import { CreateProcessDTO } from './dto/create-process.dto';
import { ApiResponseDto } from 'src/shared/dto/api-response.dto';
import { ProcessResponse } from './entity/process.entity';

@Controller('processes')
export class ProcessesController {
  constructor(private readonly processesService: ProcessesService) {}

  /**
   * POST /api/processes
   * Cria um processo no estado normal de agendamento ('SCHEDULING')
   * 
   * @param {createProcessDto} createProcessDto
   * @throws {BadRequestException}
   * @returns {Promise<ApiResponseDto<ProcessResponse, null>}
   */
  @Post()
  async create(@Body() createProcessDto : CreateProcessDTO):Promise<ApiResponseDto<ProcessResponse, null>>{
    const process = await this.processesService.create(createProcessDto);

    return {
      sucess: true,
      message: "Processo criado com sucesso",
      data: process,
    }
  }
}
