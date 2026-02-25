/**
 * Resposta da entidade PlatformCompany
 */
export class PlatformCompanyResponse {
  id: string;
  name: string;
  cnpj: string;
  bank: string;
  agency: string;
  checking_account: string;
  address?: string | null;
  cep?: string | null;
  default_commission_rate: number;
  created_at: Date;
  updated_at: Date;
}
