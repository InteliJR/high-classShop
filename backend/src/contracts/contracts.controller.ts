import {
  Body,
  Controller,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiResponseDto } from 'src/shared/dto/api-response.dto';
import { ContractResponse } from './entity/contracts.response';
import type { RequestWithUser } from 'src/auth/dto/auth';

@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  /**
   * POST /api/contracts/
   *
   * Pega o email do usuário e envia junto com as outras informações para o servico de contracts
   * Envia o documento para o ZapSign
   * Cria um contrato no banco de dados
   *
   * @param {Express.Multer.File} file - Arquivo com o contrato em pdf
   * @param {CreateContractDto} createContractDto - dto com os parâmetros necessário do body
   */
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: RequestWithUser,
    @Body() createContractDto: CreateContractDto,
  ): Promise<ApiResponseDto<ContractResponse>> {
    // Extrai o id e email do usuário
    const { id, email } = req.user;
    const contract = await this.contractsService.create(
      file,
      createContractDto,
      id,
      email,
    );

    return {
      sucess: true,
      message: 'Documento enviado com sucesso',
      data: contract,
    };
  }
}
