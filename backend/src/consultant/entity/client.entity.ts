export class ClientEntity {
  id: string;
  name: string;
  surname: string;
  email: string;
  cpf: string;
  rg: string;
  civil_state?: string;
  address_id?: string;
  consultant_id?: string;
  created_at: Date;
  updated_at: Date;
}
