// Response adquirida da API da ZapSign, para mais detalhes acesse: https://docs.zapsign.com.br/english/documentos/criar-documento

export class ZapSignResponse {
    token: string;
    status: string;
    original_file: string;
    signed_file: string | null;
}