export interface UserMock {
  name: string;
  surname: string;
  email: string;
  cpf: string;
  rg: string;
  role: 'CUSTOMER' | 'CONSULTANT' | 'SPECIALIST' | 'ADMIN';
  password_hash: string;
  
  // Propriedades opcionais...
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

// Lógica de Segurança:
// 1. Tenta ler a variável de ambiente.
// 2. Se não existir, define como string vazia.
// Resultado: Sem o .env, a senha é inválida e o login será impossível.
const COMMON_PASSWORD_HASH = process.env.MOCK_PASSWORD_HASH || '';

// (Opcional) Bloco de alerta para o desenvolvedor saber por que o login não funciona
if (!COMMON_PASSWORD_HASH) {
  console.warn(
    '\x1b[33m%s\x1b[0m', // Cor amarela no console
    '⚠️  [SECURITY] MOCK_PASSWORD_HASH não encontrado no .env. Os usuários de teste serão criados, mas o login estará BLOQUEADO.'
  );
}

export const mockUsers: UserMock[] = [
  {
    name: 'Ana',
    surname: 'Admin',
    email: 'admin@example.com',
    cpf: '11122233300',
    rg: '11223344',
    role: 'ADMIN',
    password_hash: COMMON_PASSWORD_HASH,
  },
  {
    name: 'Marcos',
    surname: 'Ribeiro',
    email: 'marcos.consultor@example.com',
    cpf: '22233344455',
    rg: '22334455',
    role: 'CONSULTANT',
    password_hash: COMMON_PASSWORD_HASH,
  },
  {
    name: 'Carlos',
    surname: 'Mecânico',
    email: 'carlos.car@example.com',
    cpf: '44455566677',
    rg: '44556677',
    role: 'SPECIALIST',
    speciality: 'CAR',
    password_hash: COMMON_PASSWORD_HASH,
  },
  {
    name: 'Marina',
    surname: 'Navegante',
    email: 'marina.boat@example.com',
    cpf: '55566677788',
    rg: '55667788',
    role: 'SPECIALIST',
    speciality: 'BOAT',
    password_hash: COMMON_PASSWORD_HASH,
  },
  {
    name: 'Pedro',
    surname: 'Aviador',
    email: 'pedro.aircraft@example.com',
    cpf: '66677788899',
    rg: '66778899',
    role: 'SPECIALIST',
    speciality: 'AIRCRAFT',
    password_hash: COMMON_PASSWORD_HASH,
  },
  {
    name: 'João',
    surname: 'Silva',
    email: 'joao.cliente@example.com',
    cpf: '77788899900',
    rg: '77889900',
    role: 'CUSTOMER',
    password_hash: COMMON_PASSWORD_HASH,
  },
];