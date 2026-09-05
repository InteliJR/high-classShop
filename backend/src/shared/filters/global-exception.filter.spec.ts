import { BadRequestException, ConflictException } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

function mkHost() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url: '/api/contracts/preview', method: 'POST' }),
    }),
  } as any;
  return { host, status, json };
}

function capturar(exception: unknown) {
  const { host, status, json } = mkHost();
  new GlobalExceptionFilter().catch(exception, host);
  return { corpo: json.mock.calls[0][0], status: status.mock.calls[0][0] };
}

describe('GlobalExceptionFilter — formato aninhado de erro', () => {
  /**
   * Vários services lançam { success, error: { code, message, details } } em vez
   * do formato do Nest. Antes, `obj.error` (objeto) caía direto em `message`, e
   * a resposta saía com message sendo objeto — o cliente perdia o motivo e
   * mostrava um erro genérico. Foi o que aconteceu com a regra de vendedor
   * diferente de especialista na criação de contrato.
   */
  const aninhado = new BadRequestException({
    success: false,
    error: {
      code: 400,
      message: 'O e-mail do vendedor deve ser diferente do e-mail do especialista.',
      details: { seller_email: 'a@b.com', specialist_email: 'a@b.com' },
    },
  });

  it('extrai a mensagem de dentro de error, como texto', () => {
    const { corpo } = capturar(aninhado);

    expect(typeof corpo.message).toBe('string');
    expect(corpo.message).toBe(
      'O e-mail do vendedor deve ser diferente do e-mail do especialista.',
    );
  });

  it('preserva os details, que a tela usa para identificar o conflito', () => {
    const { corpo } = capturar(aninhado);

    expect(corpo.details).toEqual({
      seller_email: 'a@b.com',
      specialist_email: 'a@b.com',
    });
  });

  it('não devolve objeto no campo error', () => {
    const { corpo } = capturar(aninhado);
    expect(typeof corpo.error).not.toBe('object');
  });

  it('mantém o status da exceção', () => {
    const { status } = capturar(aninhado);
    expect(status).toBe(400);
  });

  // O formato do Nest não pode regredir por causa da correção.
  it('formato padrão do Nest continua funcionando', () => {
    const { corpo } = capturar(
      new ConflictException('Já existe contrato ativo para este processo.'),
    );

    expect(corpo.message).toBe('Já existe contrato ativo para este processo.');
    expect(corpo.statusCode).toBe(409);
  });

  it('exceção sem corpo estruturado não quebra o filtro', () => {
    const { corpo } = capturar(new Error('falha inesperada'));
    expect(typeof corpo.message).toBe('string');
  });
});
