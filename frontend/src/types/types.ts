// Substituto do tipo ENUM nos postgres
// Carro
export type estadoValues = 'novo'| 'seminovo'| 'colecao';
export type tipoCategoriaCarValues = 'SUV'| 'sedan'| 'coupe'| 'conversivel'| 'esportivo'| 'supercarro';
export type cambioCarValues = 'manual'| 'automatico'| 'cvt';
export type combustivelCarValues = 'gasolina'| 'alcool'| 'flex'| 'diesel'| 'eletrico'| 'hibrido';
// Barco
export type combustivelBoatsValues = 'diesel'| 'gasolina'| 'eletrico'| 'hibrido';
export type tipoEmbarcacaoBoatsValues = 'iate'| 'lancha'| 'catamara'| 'veleiro'| 'jet_boat'| 'outro';
export type tamanhoBoatsValues = 'ate_30_pes'|'30_50_pes'|'acima_50_pes';
// Aeronave
export type tipoAeronaveValues = 'VLJ'| 'executivo_medio'| 'intercontinental'| 'turbohelice'| 'helicoptero'

// Filtros
// Carro
export interface FiltersCarMeta {
    marca?: string;
    modelo?: string;
    ano_min?: number;
    ano_max?: number;
    preco_min?: number;
    preco_max?: number;
    estado?: estadoValues;
    tipo_categoria?:tipoCategoriaCarValues;
    cor?: string;
    km_max?: number;
    cambio?: cambioCarValues;
    combustivel?: combustivelCarValues;
}
//Barco
export interface FiltersBoatsMeta {
  marca?: string;
  modelo?: string;
  ano_min?: number;
  ano_max?: number;
  preco_min?: number;
  preco_max?: number;
  estado?: estadoValues;
  tipo_embarcacao?: tipoEmbarcacaoBoatsValues;
  tamanho?: tamanhoBoatsValues;
  fabricante?: string;
  combustivel?: combustivelBoatsValues;
  motor?: string;
} 
// Aeronave
export interface FiltersAircraftsMeta {
  marca?: string;
  modelo?: string;
  ano_min?: number;
  ano_max?: number;
  preco_min?: number;
  preco_max?: number;
  estado?: estadoValues;
  tipo_embarcacao?: tipoEmbarcacaoBoatsValues;
  categoria?: string;
  tipo_aeronave: tipoAeronaveValues;
  assentos_min: number;
  assentos_max: number;
} 

//API
export interface ResponseAPI<T, S> {
    success: boolean;
    message: string;
    data: T[];
    meta: {
        pagination: PaginationMeta;
        filters: FiltersMeta<S>;
    }
}

// Utilizado como meta nas APIs
export interface FiltersMeta<T> {
    total_without_filters: number;
    applied_filters: T;
}
export interface PaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

// Informações essenciais dos produtos
export interface Product {
  id: number;
  marca: string;
  modelo: string;
  descricao: string;
  valor: number;
  imageUrl?: string;
  ano?: number;
  estado?: string;
}

// Usuários
export type UserRole = 'CUSTOMER' |'CONSULTANT' |'SPECIALIST' |'ADMIN';
export type CivilState = 'SINGLE' |'MARRIED' |'DIVORCED' |'WIDOWED' |'SEPARATED' |'STABLE_UNION' ;
export type SpecialityType = 'CAR' |'BOAT' |'AIRCRAFT';

export interface UserProps {
  id: string;
  name: string;
  surname: string;
  email: string;
  cpf: string;
  rg: string;
  role: UserRole;
  civil_state?: CivilState;
  speciality?: SpecialityType;
  identification_number?: string;
  address_id?: string;
  consultant_id?: string;
  company_id?: string;
  created_at?: Date;
}

// Tipgem das informações de login
export interface LoginValues {
  email: string;
  password: string;
}

// Tipagem das informações de registro
export interface RegisterValues {
  name: string;
  surname: string;
  email: string;
  cpf: string;
  rg: string;
  password: string;
  civil_state?: CivilState;
  consultant_id?: string;
}

// Payload decodificado do token de referral
export interface ReferralTokenPayload {
  consultantId: string;
  email: string;
  consultantName?: string;
}