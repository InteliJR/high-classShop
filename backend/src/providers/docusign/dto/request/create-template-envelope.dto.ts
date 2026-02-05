/**
 * DTO para criação de envelope usando template DocuSign
 *
 * Usado para criar contratos a partir de templates pré-definidos
 * com campos pré-preenchidos (docGenFormFields / textTabs)
 */
export class CreateTemplateEnvelopeDto {
  /**
   * ID do template no DocuSign
   * @example "141ff98d-17af-4400-85e7-4a70640e4b9a"
   */
  templateId: string;

  /**
   * Status do envelope
   * - 'created': Salvar como rascunho
   * - 'sent': Enviar imediatamente para assinatura
   */
  status: 'created' | 'sent';

  /**
   * Assunto do email enviado aos signatários
   */
  emailSubject?: string;

  /**
   * Papéis do template com dados dos signatários
   */
  templateRoles: TemplateRole[];

  /**
   * Campos customizados para rastreabilidade
   */
  customFields?: {
    textCustomFields?: Array<{
      name: string;
      value: string;
    }>;
  };

  /**
   * Campos de geração de documento (docGenFormFields)
   * Usado para preencher placeholders {{campo}} no template
   */
  docGenFormFields?: DocGenFormFieldRow[];
}

/**
 * Papel do template com dados do signatário e campos pré-preenchidos
 */
export interface TemplateRole {
  /**
   * Nome do papel definido no template
   * @example "Buyer" ou "Seller"
   */
  roleName: string;

  /**
   * Nome do signatário
   */
  name: string;

  /**
   * Email do signatário
   */
  email: string;

  /**
   * Tabs com valores pré-preenchidos
   */
  tabs?: {
    textTabs?: TextTab[];
  };
}

/**
 * Tab de texto para pré-preenchimento de campos
 */
export interface TextTab {
  /**
   * Label do campo no template (deve corresponder exatamente ao definido no template)
   * @example "seller_name", "buyer_cpf", "vehicle_model"
   */
  tabLabel: string;

  /**
   * Valor a ser preenchido no campo
   */
  value: string;
}

/**
 * Estrutura para docGenFormFields - Geração de Documento
 * Usado para preencher campos {{campo}} em templates DocuSign
 */
export interface DocGenFormFieldRow {
  /**
   * ID do documento no template (normalmente "1")
   */
  documentId: string;

  /**
   * Lista de campos a serem preenchidos
   */
  docGenFormFieldList: DocGenFormField[];
}

/**
 * Campo individual para Document Generation
 */
export interface DocGenFormField {
  /**
   * Nome/Label do campo - DEVE corresponder EXATAMENTE ao definido no template
   * Incluindo typos como "techinical", "commision"
   */
  name: string;

  /**
   * Valor a ser preenchido
   */
  value: string;
}
