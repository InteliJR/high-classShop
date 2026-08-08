import {
  EMPTY,
  bool,
  cnpj,
  cpf,
  date,
  datetime,
  document,
  hexList,
  int,
  money,
  phone,
  rate,
  text,
} from './admin-database.format';

describe('admin-database.format', () => {
  describe('cpf', () => {
    it('mascara 11 dígitos', () => {
      expect(cpf('12345678901')).toBe('123.456.789-01');
    });

    it('mascara valor que já vem pontuado (idempotente)', () => {
      expect(cpf('123.456.789-01')).toBe('123.456.789-01');
    });

    it('devolve o valor cru quando não tem 11 dígitos', () => {
      expect(cpf('123')).toBe('123');
    });
  });

  describe('cnpj', () => {
    it('mascara 14 dígitos', () => {
      expect(cnpj('12345678000199')).toBe('12.345.678/0001-99');
    });

    it('devolve o valor cru quando não tem 14 dígitos', () => {
      expect(cnpj('999')).toBe('999');
    });
  });

  describe('document', () => {
    // User.cpf é polimórfica: CPF para a maioria dos papéis, CNPJ para SPECIALIST.
    it('trata 11 dígitos como CPF', () => {
      expect(document('12345678901')).toBe('123.456.789-01');
    });

    it('trata 14 dígitos como CNPJ', () => {
      expect(document('12345678000199')).toBe('12.345.678/0001-99');
    });
  });

  describe('phone', () => {
    it('mascara celular de 9 dígitos', () => {
      expect(phone('11987654321')).toBe('(11) 98765-4321');
    });

    it('mascara fixo de 8 dígitos', () => {
      expect(phone('1133224455')).toBe('(11) 3322-4455');
    });

    it('devolve o valor cru quando o tamanho é inesperado', () => {
      expect(phone('12345')).toBe('12345');
    });
  });

  describe('money', () => {
    it('formata número em real', () => {
      expect(money(2400000)).toBe('R$ 2.400.000,00');
    });

    it('formata Decimal do Prisma sem virar notação científica nem string crua', () => {
      // O Decimal do Prisma (decimal.js) coage via toString() → "2400000.00".
      const decimalLike = { toString: () => '2400000.00' };
      expect(money(decimalLike)).toBe('R$ 2.400.000,00');
    });

    it('formata centavos', () => {
      expect(money('1234.56')).toBe('R$ 1.234,56');
    });

    it('devolve o valor cru quando não é numérico', () => {
      expect(money('abc')).toBe('abc');
    });
  });

  describe('rate', () => {
    it('formata taxa com duas casas e símbolo de porcentagem', () => {
      expect(rate({ toString: () => '15.00' })).toBe('15,00%');
    });

    it('devolve o valor cru quando não é numérico', () => {
      expect(rate('x')).toBe('x');
    });
  });

  describe('int', () => {
    it('formata inteiro com separador de milhar pt-BR', () => {
      expect(int(120000)).toBe('120.000');
    });
  });

  describe('date e datetime', () => {
    it('formata data no padrão pt-BR', () => {
      expect(date(new Date('2026-08-08T17:30:00Z'))).toBe('08/08/2026');
    });

    it('formata data e hora no fuso de São Paulo', () => {
      // 17:30 UTC = 14:30 em São Paulo (UTC-3).
      expect(datetime(new Date('2026-08-08T17:30:00Z'))).toBe('08/08/2026 14:30');
    });

    it('aceita string ISO', () => {
      expect(date('2026-08-08T17:30:00Z')).toBe('08/08/2026');
    });

    it('devolve o valor cru quando a data é inválida', () => {
      expect(date('nao-e-data')).toBe('nao-e-data');
    });
  });

  describe('bool', () => {
    it('traduz true e false', () => {
      expect(bool(true)).toBe('Sim');
      expect(bool(false)).toBe('Não');
    });
  });

  describe('hexList', () => {
    it('junta o array de cores por vírgula', () => {
      expect(hexList(['#0F172A', '#EAB308'])).toBe('#0F172A, #EAB308');
    });

    it('devolve travessão para array vazio', () => {
      expect(hexList([])).toBe(EMPTY);
    });
  });

  describe('text e vazios', () => {
    it('converte qualquer coisa em string', () => {
      expect(text(42)).toBe('42');
    });

    it('todo formatador devolve travessão para null e undefined', () => {
      const todos = [text, cpf, cnpj, document, phone, money, rate, int, date, datetime, bool, hexList];
      for (const fn of todos) {
        expect(fn(null)).toBe(EMPTY);
        expect(fn(undefined)).toBe(EMPTY);
      }
    });

    it('trata string vazia como vazio', () => {
      expect(text('')).toBe(EMPTY);
    });
  });
});
