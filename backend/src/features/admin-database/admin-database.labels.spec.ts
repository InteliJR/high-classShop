import { EMPTY } from './admin-database.format';
import {
  ESTADO_PRODUTO,
  PROCESS_STATUS,
  TIPO_AERONAVE,
  USER_ROLE,
  enumLabel,
} from './admin-database.labels';

describe('admin-database.labels', () => {
  it('traduz papel de usuário', () => {
    const fn = enumLabel(USER_ROLE);
    expect(fn('CONSULTANT')).toBe('Consultor');
    expect(fn('OFFICE')).toBe('Escritório');
  });

  it('traduz status de processo', () => {
    const fn = enumLabel(PROCESS_STATUS);
    expect(fn('PROCESSING_CONTRACT')).toBe('Contrato em processamento');
  });

  it('traduz campos gravados como string minúscula (não são enum no banco)', () => {
    // Car.estado / Aircraft.tipo_aeronave são String no schema; o valor
    // gravado é a string do @map, não o nome do membro do enum.
    expect(enumLabel(ESTADO_PRODUTO)('seminovo')).toBe('Seminovo');
    expect(enumLabel(TIPO_AERONAVE)('executivo_medio')).toBe('Executivo médio');
  });

  it('devolve o valor cru quando a chave é desconhecida — nunca vazio, nunca erro', () => {
    // Dado legado ou importado por CSV pode ter valor fora do dicionário.
    expect(enumLabel(ESTADO_PRODUTO)('valor_legado')).toBe('valor_legado');
  });

  it('devolve travessão para vazio', () => {
    const fn = enumLabel(USER_ROLE);
    expect(fn(null)).toBe(EMPTY);
    expect(fn(undefined)).toBe(EMPTY);
    expect(fn('')).toBe(EMPTY);
  });
});
