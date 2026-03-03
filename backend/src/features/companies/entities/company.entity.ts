export class Company {
  id: string; // UUID 
  name: string;
  cnpj: string;
  logo?: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
}