import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCarDto } from './cars/dto/create-car.dto';
import { UpdateCarDto } from './cars/dto/update-car.dto';
import { CreateBoatDto } from './boats/dto/create-boat.dto';
import { CreateAircraftDto } from './aircrafts/dto/create-aircraft.dto';

/**
 * Critério de aceite: a API aceita tipo/classificação fora da lista sugerida.
 *
 * O tipo específico de produto é texto livre — existem produtos fora das
 * classificações previstas, e travar a validação impediria o cadastro. Este
 * spec existe para que ninguém "conserte" isso reintroduzindo um @IsIn.
 */
async function errosDe(cls: any, payload: Record<string, unknown>) {
  return validate(plainToInstance(cls, payload), {
    skipMissingProperties: true,
  });
}

const erroNoCampo = (erros: any[], campo: string) =>
  erros.some((e) => e.property === campo);

describe('tipo de produto livre', () => {
  it.each([
    ['anfíbio', 'carro anfíbio, fora da lista'],
    ['hot rod', 'com espaço'],
    ['Fórmula 1', 'com acento e número'],
  ])('CreateCarDto aceita tipo_categoria "%s" (%s)', async (valor) => {
    const erros = await errosDe(CreateCarDto, { tipo_categoria: valor });
    expect(erroNoCampo(erros, 'tipo_categoria')).toBe(false);
  });

  it('UpdateCarDto também aceita — a edição não pode ser mais restrita', async () => {
    const erros = await errosDe(UpdateCarDto, { tipo_categoria: 'anfíbio' });
    expect(erroNoCampo(erros, 'tipo_categoria')).toBe(false);
  });

  it('CreateBoatDto aceita tipo_embarcacao fora da lista', async () => {
    const erros = await errosDe(CreateBoatDto, {
      tipo_embarcacao: 'traineira',
    });
    expect(erroNoCampo(erros, 'tipo_embarcacao')).toBe(false);
  });

  it('CreateAircraftDto aceita tipo_aeronave e categoria fora da lista', async () => {
    const erros = await errosDe(CreateAircraftDto, {
      tipo_aeronave: 'dirigível',
      categoria: 'Agrícola',
    });
    expect(erroNoCampo(erros, 'tipo_aeronave')).toBe(false);
    expect(erroNoCampo(erros, 'categoria')).toBe(false);
  });

  // Livre não é "aceita qualquer coisa": continua sendo texto.
  it('rejeita valor que não é texto', async () => {
    const erros = await errosDe(CreateCarDto, { tipo_categoria: 42 });
    expect(erroNoCampo(erros, 'tipo_categoria')).toBe(true);
  });

  // Os valores sugeridos seguem válidos — nada foi quebrado ao abrir.
  it.each(['SUV', 'sedan', 'coupe', 'conversivel', 'esportivo', 'supercarro'])(
    'sugestão "%s" continua aceita',
    async (valor) => {
      const erros = await errosDe(CreateCarDto, { tipo_categoria: valor });
      expect(erroNoCampo(erros, 'tipo_categoria')).toBe(false);
    },
  );
});
