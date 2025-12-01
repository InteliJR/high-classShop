export interface UserMock {
  name: string;
  surname: string;
  email: string;
  cpf: string;
  rg: string;
  role: 'CUSTOMER' | 'CONSULTANT' | 'SPECIALIST' | 'ADMIN';
  password_hash: string;

  civil_state?:
    | 'SINGLE'
    | 'MARRIED'
    | 'DIVORCED'
    | 'WIDOWED'
    | 'SEPARATED'
    | 'STABLE_UNION'
    | null;
  speciality?: 'CAR' | 'BOAT' | 'AIRCRAFT' | null;
  identification_number?: string | null;

  address_id?: string | null;
  consultant_id?: string | null;
  company_id?: string | null;

  cars?: any[];
  boats?: any[];
  aircraft?: any[];
  processesAsClient?: any[];
  processesAsSpecialist?: any[];
  appointmentsAsClient?: any[];
  appointmentsAsSpecialist?: any[];
  car_interests?: any[];
  boat_interests?: any[];
  aircraft_interests?: any[];
  refreshTokens?: any[];
}

// Senha: "teste@123"
export const mockUsers: UserMock[] = [
  {
    name: 'Ana',
    surname: 'Admin',
    email: 'admin@example.com',
    cpf: '11122233300',
    rg: '11223344',
    role: 'ADMIN',
    password_hash:
      '$2b$10$ZLDFP8oPZxC0vNNPJBWl9O8D6hxkNfo0Rm4G5M5mA4q0O5F3ZRQda',
  },
  {
    name: 'Marcos',
    surname: 'Ribeiro',
    email: 'marcos.consultor@example.com',
    cpf: '22233344455',
    rg: '22334455',
    role: 'CONSULTANT',
    password_hash:
      '$2b$10$ZLDFP8oPZxC0vNNPJBWl9O8D6hxkNfo0Rm4G5M5mA4q0O5F3ZRQda',
  },
  {
    name: 'Carlos',
    surname: 'Mecânico',
    email: 'carlos.car@example.com',
    cpf: '44455566677',
    rg: '44556677',
    role: 'SPECIALIST',
    speciality: 'CAR',
    password_hash:
      '$2b$10$ZLDFP8oPZxC0vNNPJBWl9O8D6hxkNfo0Rm4G5M5mA4q0O5F3ZRQda',
  },
  {
    name: 'João',
    surname: 'Silva',
    email: 'joao.cliente@example.com',
    cpf: '77788899900',
    rg: '77889900',
    role: 'CUSTOMER',
    password_hash:
      '$2b$10$ZLDFP8oPZxC0vNNPJBWl9O8D6hxkNfo0Rm4G5M5mA4q0O5F3ZRQda',
  },
];
