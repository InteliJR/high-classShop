import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { ContractResponse } from './entity/contracts.response';
import { S3Service } from 'src/aws/s3.service';
import { api } from './api/api';
import { ZapSignResponse } from './entity/zapSign.response';
import { PostZapSignDto } from './dto/post-docs-zapSign.dto';

@Injectable()
export class ContractsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly s3Service: S3Service,
  ) {}

  /**
   * Salvar o arquivo no bucket S3
   * Enviar o arquivo para a API do zapsign
   * Criar o contrato no banco de dados
   *
   * @param {Express.Multer.File} file - Arquivo em pdf do contrato
   * @param {CreateContractDto} createContractDto - Parâmetros para criar um novo contrato
   * @returns {ContractResponse} -Contrato para estar na response da api
   */
  async create(
    file: Express.Multer.File,
    createContractDto: CreateContractDto,
    userId: string,
    userEmail: string,
  ): Promise<ContractResponse> {
    // Salvar o arquivo na S3
    const key = `contracts/${createContractDto.process_id}/${Date.now()}-${file.originalname}`;
    const fileKey = await this.s3Service.uploadFile(file, key);

    // Gerar a signedUrl para enviar no zapSign
    const signedUrl = await this.s3Service.getSignedUrl(fileKey);

    try {
      // Transaction no banco de dados para criar o contrato
      const createdContract = await this.prismaService.$transaction(
        async (tx) => {
          // Pegar as informações do usuário que irá assinar
          const userSigner = await tx.user.findUniqueOrThrow({
            where: { email: createContractDto.client_email },
          });

          // Pegar informações do usuário que upou
          const userUploader = await tx.user.findUniqueOrThrow({
            where: { id: userId },
          });

          // Cria um contrato para ser atualizado com as informações do zapSign depois
          const contract = await tx.contract.create({
            data: {
              process_id: createContractDto.process_id,
              description: createContractDto.description,

              file_name: file.originalname,
              file_path: fileKey,
              file_type: file.mimetype,
              file_size: file.size,
              original_pdf_url: signedUrl,
              uploaded_by_id: userId,
              uploaded_by_type: userUploader.role,

              signed_by_id: userSigner.id,
              created_at: new Date(),
            },
          });

          // Enviar para a API do zapSign
          const response = await api.post<ZapSignResponse>(
            '/docs',
            {
              name: file.filename,
              url_pdf: signedUrl,
              created_by: userEmail,
              folder_path: `process_${createContractDto.process_id}/contract_${contract.id}`,
              signers: [
                {
                  name: `${userSigner.name} ${userSigner.surname}`,
                  auth_mode: 'assinaturaTela',
                  email: createContractDto.client_email,
                },
              ],
            } as PostZapSignDto,
            {
              headers: {
                Authorization: `Bearer ${process.env.ZAPSIGN_TOKEN}`,
              },
            },
          );

          // Atualiza com as informações do ZapSign
          return await tx.contract.update({
            where: {
              id: contract.id,
            },
            data: {
              zapsign_token: response.data.token,
              signer_link: response.data.original_file,
            },
            include: {
              uploaded_by: true,
            },
          });
        },
      );

      return {
        id: createdContract.id,
        description: createdContract.description,
        file_name: createdContract.file_name,
        file_size: createdContract.file_size,
        file_type: createdContract.file_type,
        process_id: createdContract.process_id,
        uploaded_by: {
          id: createdContract.uploaded_by_id,
          name: createdContract.uploaded_by.name,
          type: createdContract.uploaded_by_type,
        },
        created_at: createdContract.created_at,
      };
    } catch (err) {
      throw new InternalServerErrorException();
    }
  }
}
