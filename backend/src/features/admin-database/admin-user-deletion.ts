import { randomBytes, randomUUID } from 'crypto';

/**
 * Excluir um usuário aqui é apagar a *identidade*, não a linha.
 *
 * Processos, propostas e contratos referenciam o usuário por FK obrigatória:
 * apagar a linha derrubaria o histórico junto, que é justamente o que a task
 * proíbe. Então a linha permanece — nome e papel intactos, para as telas de
 * processo continuarem legíveis — e o que sai são os identificadores únicos,
 * liberando-os para um novo cadastro.
 */

/** Domínio reservado pela RFC 2606: nunca resolve, nunca entrega e-mail. */
const DOMINIO_MORTO = 'deleted.invalid';

/**
 * E-mail lápide, único por construção.
 *
 * O uuid evita colisão entre duas exclusões, e o domínio reservado garante
 * que ninguém receba e-mail nesse endereço por acidente.
 */
export function emailDeExclusao(): string {
  return `deleted+${randomUUID()}@${DOMINIO_MORTO}`;
}

/**
 * RG lápide.
 *
 * A coluna é NOT NULL e VarChar(11), então não dá para limpar: tem que caber
 * um valor. O prefixo 'X' garante que nunca colida com um RG real, que é só
 * dígitos, e os 10 hex dão espaço suficiente para não colidir entre lápides.
 */
export function rgDeExclusao(): string {
  return `X${randomBytes(5).toString('hex')}`;
}

/**
 * Hash de senha impossível de satisfazer.
 *
 * Não é o que barra o login — o e-mail lápide já basta, e is_active também.
 * É defesa em profundidade: se alguém reativar a conta pelo painel do
 * escritório, as credenciais antigas ainda não valem nada.
 */
export function senhaDeExclusao(): string {
  return `excluido:${randomBytes(32).toString('hex')}`;
}

/** Reconhece uma conta já excluída, sem precisar de coluna nova. */
export function foiExcluido(email: string | null | undefined): boolean {
  return !!email && email.endsWith(`@${DOMINIO_MORTO}`);
}
