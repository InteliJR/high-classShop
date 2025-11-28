import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ProcessesService } from './processes.service';
import { CreateProcessDTO } from './dto/create-process.dto';
import { ApiResponseDto } from 'src/shared/dto/api-response.dto';
import { ProcessResponse } from './entity/process.entity';
import { QueryDto } from 'src/shared/dto/query.dto';
import { ProcessSummary } from 'src/shared/dto/summary.dto';
import { PaginationDto } from 'src/shared/dto/pagination.dto';

@Controller('processes')
export class ProcessesController {
  constructor(private readonly processesService: ProcessesService) {}

  /**
   * POST /api/processes
   * Cria um processo no estado normal de agendamento ('SCHEDULING')
   *
   * @param {createProcessDto} createProcessDto - Dto para criar o processo
   * @throws {BadRequestException} - Request incorreta
   * @returns {Promise<ApiResponseDto<ProcessResponse>>} - Processo com o formato de resposta de API
   */
  @Post()
  async create(
    @Body() createProcessDto: CreateProcessDTO,
  ): Promise<ApiResponseDto<ProcessResponse>> {
    const process = await this.processesService.create(createProcessDto);

    return {
      sucess: true,
      message: 'Processo criado com sucesso',
      data: process,
    };
  }

  /**
   * GET /api/processes
   * Retorna os processos de maneira paginada
   *
   * @param {QueryDto} - Parâmetros de paginação
   * @returns {Promise<ApiResponseDto<ProcessResponse[], unknown, ProcessSummary>>} - Listagem de processos de maneira paginada e sumário
   */
  @Get()
  async getAll(
    @Query() { perPage, page }: QueryDto,
  ): Promise<ApiResponseDto<ProcessResponse[], unknown, ProcessSummary>> {
    // Tratamento de variáveis do front
    page = Number(page);
    perPage = Number(perPage);

    const { count, processes, byStatus } = await this.processesService.getAll({
      perPage,
      page,
    });

    // Criação do objeto de pagination
    const skip = (page - 1) * perPage;
    const pagination = new PaginationDto();
    pagination.current_page = page;
    pagination.total_pages = count / perPage;
    pagination.has_next = skip + perPage < count;
    pagination.has_prev = skip > 0;
    pagination.total = count;
    pagination.total_pages = count / page;

    return {
      sucess: true,
      message: 'Processos listados com sucesso',
      data: processes,
      meta: {
        pagination: pagination,
        summary: {
          by_status: byStatus,
        },
      },
    };
  }
}
