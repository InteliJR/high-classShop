import { Injectable, Logger } from '@nestjs/common';
import { PDFDocument, PDFPage, rgb } from 'pdf-lib';
import { PdfProcessingException } from 'src/shared/exceptions/custom-exceptions';
import { StandardFonts } from 'pdf-lib';

/**
 * Serviço de Manipulação de PDF
 *
 * Responsabilidades:
 * - Criar PDF estático de assinatura com anchors de texto
 * - Fazer merge de PDFs (original + assinatura)
 * - Processar contrato PDF completo
 *
 * Por que robusto:
 * - PDF pode estar corrompido → try/catch em cada operação
 * - pdf-lib pode falhar se arquivo malformado → trata exceções
 * - Retorna Buffer processado seguro (sem expor stack internos)
 * - Logs detalhados para debugging de problemas de PDF
 */
@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  // Função utilitária para quebrar texto em múltiplas linhas
  private splitTextIntoLines(
    text: string,
    maxWidth: number,
    font: any, // PDF embedded font
    fontSize: number,
  ): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, fontSize);
      if (width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  /**
   * Cria um PDF estático de assinatura com text anchors
   *
   * Estrutura:
   * - Página A4 (595x842 pontos)
   * - Título "ASSINATURA DO CONTRATO"
   * - 3 campos com text anchors (DocuSign localiza e substitui):
   *   - "client_signature" → campo de assinatura
   *   - "client_name" → campo de nome
   *   - "client_date" → campo de data
   *
   * Robustez:
   * - Trata exceções de criação de página
   * - Validação de buffer gerado
   * - Logs detalhados
   *
   * @returns {Promise<Buffer>} Buffer do PDF de assinatura
   * @throws PdfProcessingException - Se falhar ao criar PDF
   */
  async createSignaturePdf(): Promise<Buffer> {
    try {
      this.logger.debug(`Criando PDF de assinatura estático...`);

      // Criar novo documento PDF
      const pdfDoc = await PDFDocument.create();

      // Adicionar página A4
      const page = pdfDoc.addPage([595, 842]); // A4: 595x842 pontos
      const { width, height } = page.getSize();
      const margin = 40;
      let yPosition = height - 100;

      // Adiciona fonte
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // ===== CONTEÚDO VISUAL =====

      // Título
      page.drawText('ASSINATURA DO CONTRATO', {
        x: margin,
        y: yPosition,
        size: 18,
        color: rgb(0, 0, 0),
      });

      // Texto informativo
      yPosition -= 60;
      const lineHeight = 20;
      const infoText =
        'As partes abaixo identificadas declaram que leram, compreenderam e concordam integralmente com os termos do contrato apresentado nas páginas anteriores, assinando-o eletronicamente por meio da plataforma DocuSign, nos termos da legislação aplicável.';

      const maxTextWidth = width - margin * 2;
      const infoLines = this.splitTextIntoLines(
        infoText,
        maxTextWidth,
        font,
        12,
      );

      for (const line of infoLines) {
        page.drawText(line, {
          x: margin,
          y: yPosition,
          size: 12,
          font,
          color: rgb(0.3, 0.3, 0.3),
        });
        yPosition -= lineHeight;
      }

      // ===== CAMPO 1: ASSINATURA =====

      page.drawText('Assinatura:', {
        x: margin,
        y: yPosition,
        size: 11,
        color: rgb(0, 0, 0),
      });

      yPosition -= lineHeight;

      // Linha para assinatura
      page.drawLine({
        start: { x: margin, y: yPosition - 5 },
        end: { x: width - margin, y: yPosition - 5 },
        thickness: 1,
        color: rgb(0.7, 0.7, 0.7),
      });

      // TEXT ANCHOR: DocuSign procura por "client_signature" e adiciona pad de assinatura aqui
      page.drawText('client_signature', {
        x: margin,
        y: yPosition - 20,
        size: 8,
        color: rgb(0.9, 0.9, 0.9), // Quase invisível
      });

      yPosition -= 60;

      // ===== CAMPO 2: NOME =====

      page.drawText('Nome:', {
        x: margin,
        y: yPosition,
        size: 11,
        color: rgb(0, 0, 0),
      });

      yPosition -= lineHeight;

      page.drawLine({
        start: { x: margin, y: yPosition - 5 },
        end: { x: width - margin, y: yPosition - 5 },
        thickness: 1,
        color: rgb(0.7, 0.7, 0.7),
      });

      // TEXT ANCHOR: DocuSign procura por "client_name" e preenche automaticamente
      page.drawText('client_name', {
        x: margin,
        y: yPosition - 20,
        size: 8,
        color: rgb(0.9, 0.9, 0.9),
      });

      yPosition -= 60;

      // ===== CAMPO 3: DATA =====

      page.drawText('Data:', {
        x: margin,
        y: yPosition,
        size: 11,
        color: rgb(0, 0, 0),
      });

      yPosition -= lineHeight;

      page.drawLine({
        start: { x: margin, y: yPosition - 5 },
        end: { x: width / 2 - margin / 2, y: yPosition - 5 },
        thickness: 1,
        color: rgb(0.7, 0.7, 0.7),
      });

      // TEXT ANCHOR: DocuSign procura por "client_date" e preenche automaticamente
      page.drawText('client_date', {
        x: margin,
        y: yPosition - 20,
        size: 8,
        color: rgb(0.9, 0.9, 0.9),
      });

      // Salvar PDF em bytes
      const pdfBytes = await pdfDoc.save();
      const pdfBuffer = Buffer.from(pdfBytes);

      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('Buffer PDF gerado está vazio');
      }

      this.logger.debug(
        `✓ PDF de assinatura criado (${pdfBuffer.length} bytes)`,
      );

      return pdfBuffer;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(`Erro ao criar PDF de assinatura: ${errorMessage}`);

      throw new PdfProcessingException(
        `Falha ao criar PDF de assinatura: ${errorMessage}`,
      );
    }
  }

  /**
   * Faz o merge de um PDF original com o PDF de assinatura
   *
   * Fluxo:
   * 1. Carregar PDF original do buffer
   * 2. Carregar PDF de assinatura do buffer
   * 3. Copiar todas as páginas do PDF de assinatura
   * 4. Adicionar à final do PDF original
   * 5. Salvar e retornar buffer
   *
   * Robustez:
   * - Trata PDF corrompido (load fails)
   * - Validação de buffers de entrada
   * - Trata erro de copy de páginas
   * - Logs detalhados
   *
   * @param {Buffer} originalPdfBuffer - Buffer do PDF original
   * @param {Buffer} signaturePdfBuffer - Buffer do PDF de assinatura
   * @returns {Promise<Buffer>} Buffer do PDF merged
   * @throws PdfProcessingException - Se merge falhar
   */
  async mergePdfs(
    originalPdfBuffer: Buffer,
    signaturePdfBuffer: Buffer,
  ): Promise<Buffer> {
    try {
      // Validação de entrada
      if (!originalPdfBuffer || originalPdfBuffer.length === 0) {
        throw new Error('PDF original está vazio ou inválido');
      }

      if (!signaturePdfBuffer || signaturePdfBuffer.length === 0) {
        throw new Error('PDF de assinatura está vazio ou inválido');
      }

      this.logger.debug(
        `Iniciando merge: Original ${originalPdfBuffer.length}B + Assinatura ${signaturePdfBuffer.length}B`,
      );

      // 1. Carregar PDF original (pode estar corrompido)
      let originalPdf: PDFDocument;
      try {
        originalPdf = await PDFDocument.load(originalPdfBuffer, {
          // Flags de tolerância para PDFs com estrutura incomum
          ignoreEncryption: true,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        throw new Error(
          `PDF original está corrompido ou inválido: ${errorMsg}`,
        );
      }

      this.logger.debug(
        `PDF original carregado (${originalPdf.getPageCount()} páginas)`,
      );

      // 2. Carregar PDF de assinatura
      let signaturePdf: PDFDocument;
      try {
        signaturePdf = await PDFDocument.load(signaturePdfBuffer, {
          ignoreEncryption: true,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        throw new Error(`PDF de assinatura está corrompido: ${errorMsg}`);
      }

      this.logger.debug(
        `PDF de assinatura carregado (${signaturePdf.getPageCount()} páginas)`,
      );

      // 3. Copiar páginas do PDF de assinatura
      let signaturePages: PDFPage[];
      try {
        signaturePages = await originalPdf.copyPages(
          signaturePdf,
          signaturePdf.getPageIndices(),
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        throw new Error(`Falha ao copiar páginas: ${errorMsg}`);
      }

      this.logger.debug(
        `${signaturePages.length} página(s) de assinatura copiada(s)`,
      );

      // 4. Adicionar páginas copiadas ao final do PDF original
      signaturePages.forEach((page, index) => {
        try {
          originalPdf.addPage(page);
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          throw new Error(`Falha ao adicionar página ${index}: ${errorMsg}`);
        }
      });

      // 5. Salvar PDF merged
      let mergedPdfBytes: Uint8Array;
      try {
        mergedPdfBytes = await originalPdf.save();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        throw new Error(`Falha ao salvar PDF merged: ${errorMsg}`);
      }

      const mergedBuffer = Buffer.from(mergedPdfBytes);

      if (!mergedBuffer || mergedBuffer.length === 0) {
        throw new Error('Buffer do PDF merged está vazio');
      }

      this.logger.debug(
        `✓ PDF merged com sucesso (${mergedBuffer.length} bytes)`,
      );

      return mergedBuffer;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(`Erro ao fazer merge de PDFs: ${errorMessage}`);

      throw new PdfProcessingException(
        `Falha ao mesclar PDFs: ${errorMessage}`,
      );
    }
  }

  /**
   * Processa um PDF de contrato completo
   *
   * Fluxo:
   * 1. Criar PDF de assinatura estático
   * 2. Fazer merge com PDF original
   * 3. Retornar PDF final processado
   *
   * Robustez:
   * - Trata exceções de cada etapa
   * - Logs de progresso
   * - Exceções customizadas
   *
   * @param {Buffer} originalPdfBuffer - Buffer do PDF enviado pelo usuário
   * @returns {Promise<Buffer>} Buffer do PDF final processado
   * @throws PdfProcessingException - Se processamento falhar
   */
  async processContractPdf(originalPdfBuffer: Buffer): Promise<Buffer> {
    try {
      if (!originalPdfBuffer || originalPdfBuffer.length === 0) {
        throw new Error('PDF original não fornecido ou está vazio');
      }

      this.logger.log(
        `Processando PDF do contrato (${originalPdfBuffer.length} bytes)...`,
      );

      // Etapa 1: Criar PDF de assinatura
      const signaturePdf = await this.createSignaturePdf();

      // Etapa 2: Fazer merge
      const mergedPdf = await this.mergePdfs(originalPdfBuffer, signaturePdf);

      this.logger.log(
        `✓ PDF do contrato processado com sucesso (${mergedPdf.length} bytes)`,
      );

      return mergedPdf;
    } catch (error) {
      // Se já é uma exceção customizada, re-lança
      if (error instanceof PdfProcessingException) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(`Erro ao processar PDF do contrato: ${errorMessage}`);

      throw new PdfProcessingException(
        `Falha ao processar contrato: ${errorMessage}`,
      );
    }
  }
}
