import { ProposalStatus, UserRole } from '@prisma/client';

/**
 * Entidade de resposta para propostas de negociação
 *
 * Estrutura padronizada para retorno da API
 * Inclui dados do autor e destinatário para exibição no chat
 */
export class ProposalResponseEntity {
  id: string;
  process_id: string;
  proposed_value: number;
  status: ProposalStatus;
  message?: string;
  counter_to_id?: string;
  created_at: Date;
  updated_at: Date;

  proposed_by: {
    id: string;
    name: string;
    surname: string;
    role: UserRole;
  };

  proposed_to: {
    id: string;
    name: string;
    surname: string;
    role: UserRole;
  };
}

/**
 * Entidade de resumo para listagem de propostas
 * Inclui informações do processo e produto para contexto
 */
export class ProposalListResponseEntity {
  proposals: ProposalResponseEntity[];
  process: {
    id: string;
    status: string;
    product_type: string | null; // Null para processos de consultoria sem produto atribuído
    product_is_active?: boolean;
    product_value: number;
    minimum_value: number; // 80% do valor do produto
    client: {
      id: string;
      name: string;
      surname: string;
    };
    specialist: {
      id: string;
      name: string;
      surname: string;
    };
  };
  meta: {
    total: number;
    pending_response_from?: string; // ID de quem deve responder
    can_create_proposal: boolean;
    accepted_proposal_id?: string;
  };
}
