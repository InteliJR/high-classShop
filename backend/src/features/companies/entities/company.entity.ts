export class Company {
  id: string; // UUID
  name: string;
  cnpj: string;
  logo?: string;
  description?: string;
  color_identity?: string[];
  created_at: Date;
  updated_at: Date;
}