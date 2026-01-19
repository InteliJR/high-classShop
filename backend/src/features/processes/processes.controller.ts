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
  UseGuards,
  Req,
} from '@nestjs/common';
import { ProcessesService } from './processes.service';
import { CreateProcessDTO } from './dto/create-process.dto';
import { ApiResponseDto } from 'src/shared/dto/api-response.dto';
import { ProcessResponse } from './entity/process.response.entity';
import { QueryDto } from 'src/shared/dto/query.dto';
import { ProcessSummary } from 'src/shared/dto/summary.dto';
import { PaginationDto } from 'src/shared/dto/pagination.dto';
import { UpdateProcessDto } from './dto/update-process.dto';
import { RejectProcessDto } from './dto/reject-process.dto';
import { ProcessWithHistory } from './entity/process-history.response';
import { AuthGuard } from 'src/auth/auth.guard';

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

  /**
   * GET /api/processes/:id/completion-reason
   * Retorna a razão de conclusão do processo
   *
   * @param {string} processId - Id do processo obtido nos parametros
   * @returns {Promise<ApiResponseDto<{ reason: string | null }>>}
   * @throws {NotFoundException} - Não existe nenhum processo com o id passado
   */
  @Get(':id/completion-reason')
  async getCompletionReason(
    @Param('id', new ParseUUIDPipe()) processId: string,
  ): Promise<ApiResponseDto<{ reason: string | null }>> {
    const reason =
      await this.processesService.getProcessCompletionReason(processId);

    return {
      sucess: true,
      message: 'Razão de conclusão do processo obtida com sucesso',
      data: { reason },
    };
  }

  /**
   * GET /api/processes/:id/with-contract
   * Retorna processo com dados do contrato ativo
   *
   * @param {string} processId - Id do processo obtido nos parametros
   * @returns {Promise<ApiResponseDto<any>>}
   * @throws {NotFoundException} - Não existe nenhum processo com o id passado
   */
  @Get(':id/with-contract')
  async getWithContract(
    @Param('id', new ParseUUIDPipe()) processId: string,
  ): Promise<ApiResponseDto<any>> {
    const processWithContract =
      await this.processesService.getByIdWithActiveContract(processId);

    return {
      sucess: true,
      message: 'Processo com contrato ativo obtido com sucesso',
      data: processWithContract,
    };
  }

  /**
   * GET /api/processes/client/:clientId
   * Retorna processos de um cliente específico
   *
   * @param {string} clientId - Id do cliente
   * @param {QueryDto} - Parâmetros de paginação
   * @returns {Promise<ApiResponseDto<ProcessResponse[], unknown>>} - Processos do cliente de forma paginada
   */
  @Get('client/:clientId')
  @UseGuards(AuthGuard)
  async getByClient(
    @Param('clientId', new ParseUUIDPipe()) clientId: string,
    @Query() { perPage, page }: QueryDto,
  ): Promise<ApiResponseDto<ProcessResponse[], unknown>> {
    page = Number(page);
    perPage = Number(perPage);

    const { processes, count } = await this.processesService.getByClientId(
      clientId,
      { page, perPage },
    );

    const skip = (page - 1) * perPage;
    const pagination = new PaginationDto();
    pagination.current_page = page;
    pagination.total_pages = Math.ceil(count / perPage);
    pagination.has_next = skip + perPage < count;
    pagination.has_prev = skip > 0;
    pagination.total = count;

    return {
      sucess: true,
      message: 'Processos do cliente listados com sucesso',
      data: processes,
      meta: {
        pagination,
        summary: {
          total_client_processes: count,
        },
      },
    };
  }

  /**
   * PATCH /api/processes/:id/reject
   * Rejeita um processo com motivo opcional
   *
   * @param {string} processId - Id do processo
   * @param {RejectProcessDto} rejectProcessDto - Motivo da rejeição (opcional)
   * @param {Request} req - Request com dados do usuário autenticado
   * @returns {Promise<ApiResponseDto<ProcessWithHistory>>}
   * @throws {NotFoundException} - Processo não encontrado
   * @throws {BadRequestException} - Processo já está rejeitado
   */
  @Patch(':id/reject')
  @UseGuards(AuthGuard)
  async rejectProcess(
    @Param('id', new ParseUUIDPipe()) processId: string,
    @Body() rejectProcessDto: RejectProcessDto,
    @Req() req: any,
  ): Promise<ApiResponseDto<ProcessWithHistory>> {
    const userId = req.user?.sub || req.user?.id;

    const result = await this.processesService.rejectProcess(
      processId,
      userId,
      rejectProcessDto.rejection_reason,
    );

    return {
      sucess: true,
      message: 'Processo rejeitado com sucesso',
      data: result,
    };
  }
}
