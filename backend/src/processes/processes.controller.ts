import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ProcessesService } from './processes.service';
import { CreateProcessDTO } from './dto/create-process.dto';
import { ApiResponseDto } from 'src/shared/dto/api-response.dto';
import { ProcessResponse } from './entity/process.response.entity';
import { QueryDto } from 'src/shared/dto/query.dto';
import { ProcessSummary } from 'src/shared/dto/summary.dto';
import { PaginationDto } from 'src/shared/dto/pagination.dto';
import { UpdateProcessDto } from './dto/update-process.dto';
import { ProcessWithHistory } from './entity/process-history.response';

@Controller('processes')
export class ProcessesController {
  constructor(private readonly processesService: ProcessesService) {}

  /**
   * POST /api/processes
   * Cria um processo no estado normal de agendamento ('SCHEDULING')
   *
   * @param {CreateProcessDTO} createProcessDto - Dto para criar o processo
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
    pagination.total_pages = Math.ceil(count / perPage);
    pagination.has_next = skip + perPage < count;
    pagination.has_prev = skip > 0;
    pagination.total = count;

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

  /**
   * GET /api/processes/:id
   * Get a single process by its ID
   *
   * @param {string} processId - The ID of the process (UUID)
   * @returns {Promise<ApiResponseDto<ProcessResponse>>} - Single process with all related data
   * @throws {NotFoundException} - Process not found
   */
  @Get(':id')
  async getById(
    @Param('id', new ParseUUIDPipe()) processId: string,
  ): Promise<ApiResponseDto<ProcessResponse>> {
    const process = await this.processesService.getById(processId);

    return {
      sucess: true,
      message: 'Processo obtido com sucesso',
      data: process,
    };
  }

  /**
   * GET /api/processes/specialist/:specialistId
   * Get all processes created by a specific specialist
   *
   * @param {string} specialistId - The ID of the specialist
   * @param {QueryDto} - Parâmetros de paginação
   * @returns {Promise<ApiResponseDto<ProcessResponse[], unknown, unknown>>} - Processos do especialista de forma paginada
   */
  @Get('specialist/:specialistId')
  async getBySpecialist(
    @Param('specialistId', new ParseUUIDPipe()) specialistId: string,
    @Query() { perPage, page }: QueryDto,
  ): Promise<ApiResponseDto<ProcessResponse[], unknown>> {
    // Tratamento de variáveis do front
    page = Number(page);
    perPage = Number(perPage);

    const { processes, count } = await this.processesService.getBySpecialistId(
      specialistId,
      { page, perPage },
    );

    // Criação do objeto de pagination
    const skip = (page - 1) * perPage;
    const pagination = new PaginationDto();
    pagination.current_page = page;
    pagination.total_pages = Math.ceil(count / perPage);
    pagination.has_next = skip + perPage < count;
    pagination.has_prev = skip > 0;
    pagination.total = count;

    return {
      sucess: true,
      message: 'Processos do especialista listados com sucesso',
      data: processes,
      meta: {
        pagination,
        summary: {
          total_specialist_processes: count,
        },
      },
    };
  }

  /**
   * PATCH /api/processes/:id/status
   * Atualiza status do processo
   *
   * @param {string} processId - Id do processo obtido nos parametros
   * @param {UpdateProcessDto} updateProcessDto - Parâmetros obtidos do body da request para atualizar os status de um processo
   * @returns {Promise<ApiResponseDto<ProcessWithHistory>>}
   * @throws {BadRequestException} - Request errada
   * @throws {NotFoundException} - Não existe nenhum processo com o id passado
   * @throws {InternalServerErrorException} - Erro desconhecido
   */
  @Patch(':id/status')
  async update(
    @Param('id', new ParseUUIDPipe()) processId: string,
    @Body() updateProcessDto: UpdateProcessDto,
  ): Promise<ApiResponseDto<ProcessWithHistory>> {
    const updatedProcess = await this.processesService.update(
      processId,
      updateProcessDto,
    );

    return {
      sucess: true,
      message: 'Status do processo atualizado com sucesso',
      data: updatedProcess,
    };
  }
}
