//Fltro dos tipos
//Carro
// Substituto do tipo ENUM nos postgres
export type estadoValues = ['novo', 'seminovo', 'colecao'];
export type tipoCategoriaCarValues = [
  'SUV',
  'sedan',
  'coupe',
  'conversivel',
  'esportivo',
  'supercarro',
];
export type cambioCarValues = ['manual', 'automatico', 'cvt'];
export type combustivelCarValues = [
  'gasolina',
  'alcool',
  'flex',
  'diesel',
  'eletrico',
  'hibrido',
];
export class FiltersCarMeta {
  search?: string;
  marca?: string;
  modelo?: string;
  ano_min?: number;
  ano_max?: number;
  preco_min?: number;
  preco_max?: number;
  estado?: estadoValues;
  tipo_categoria?: tipoCategoriaCarValues;
  cor?: string;
  km_max?: number;
  cambio?: cambioCarValues;
  combustivel?: combustivelCarValues;
  // Filtro adicional para vincular produtos a um especialista específico
  specialist_id?: string;
}
export class ContainsCarFilters {
  marca?: string;
  modelo?: string;
  cor?: string;
}

export class ExactCarFilters {
  estado?: estadoValues;
  tipo_categoria?: tipoCategoriaCarValues;
  cambio?: cambioCarValues;
  combustivel?: combustivelCarValues;
}
export class RangeCarFilters {
  ano_min?: number;
  ano_max?: number;
  preco_min?: number;
  preco_max?: number;
  km_max?: number;
}

// Barco
export type combustivelBoatValues = [
  'diesel',
  'gasolina',
  'eletrico',
  'hibrido',
];
export type tipoEmbarcacaoBoatValues = [
  'iate',
  'lancha',
  'catamara',
  'veleiro',
  'jet_boat',
  'outro',
];
export type tamanhoBoatValues = ['ate_30_pes', '30_50_pes', 'acima_50_pes'];
export class FiltersBoatMeta {
  marca?: string;
  modelo?: string;
  ano_min?: number;
  ano_max?: number;
  preco_min?: number;
  preco_max?: number;
  estado?: estadoValues;
  tipo_embarcacao?: tipoEmbarcacaoBoatValues;
  tamanho?: tamanhoBoatValues;
  fabricante?: string;
  combustivel?: combustivelBoatValues;
  motor?: string;
  // Filtro adicional para vincular produtos a um especialista específico
  specialist_id?: string;
}
export class ExactBoatFilters {
  estado?: estadoValues;
  tipo_embarcacao?: tipoEmbarcacaoBoatValues;
  tamanho?: tamanhoBoatValues;
  combustivel?: combustivelBoatValues;
}

export class ContainsBoatFilters {
  marca?: string;
  modelo?: string;
  fabricante?: string;
  motor?: string;
}
export class RangeBoatFilters {
  ano_min?: number;
  ano_max?: number;
  preco_min?: number;
  preco_max?: number;
}

// Aeronaves
export type tipoAeronaveValues = [
  'VLJ',
  'executivo_medio',
  'intercontinental',
  'turbohelice',
  'helicoptero',
];
export class FiltersAircraftMeta {
  marca?: string;
  modelo?: string;
  ano_min?: number;
  ano_max?: number;
  preco_min?: number;
  preco_max?: number;
  estado?: estadoValues;
  categoria?: string;
  tipo_aeronave?: tipoAeronaveValues;
  assentos_min?: number;
  assentos_max?: number;
  // Filtro adicional para vincular produtos a um especialista específico
  specialist_id?: string;
}
export class ExactAircraftFilters {
  tipo_aeronave?: tipoAeronaveValues;
  estado?: estadoValues;
}
export class ContainsAircraftFilters {
  marca?: string;
  modelo?: string;
  categoria?: string;
}
export class RangeAircraftFilters {
  ano_min?: number;
  ano_max?: number;
  preco_min?: number;
  preco_max?: number;
  assentos_min?: number;
  assentos_max?: number;
}

// MetaData de filtros
export class FiltersDto<T> {
  total_without_filters: number;
  applied_filters: T;
}
