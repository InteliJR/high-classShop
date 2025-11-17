export class Specialist {
  id: string; // UUID
  name: string;
  surname: string;
  email: string;
  cpf: string;
  rg: string;
  password_hash: string;
  speciality: string; // CAR, BOAT ou AIRCRAFT
  created_at: Date;
  updated_at: Date;
}
