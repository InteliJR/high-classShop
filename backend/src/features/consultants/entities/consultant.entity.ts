export class Consultant {
  id: string; // UUID
  name: string;
  surname: string;
  email: string;
  cpf: string;
  rg: string;
  password_hash: string;
  company_id: string; // UUID - Referência ao Escritório Parceiro
  created_at: Date;
  updated_at: Date;
}
