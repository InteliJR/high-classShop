import { ProductType, UserRole } from '@prisma/client';
import {
  blockerMessage,
  roleLabel,
  specialityLabel,
} from './admin-user-management.labels';

describe('admin-user-management.labels', () => {
  it.each([
    [UserRole.CUSTOMER, 'Cliente'],
    [UserRole.CONSULTANT, 'Consultor'],
    [UserRole.SPECIALIST, 'Especialista'],
    [UserRole.OFFICE, 'Gerente de escritório'],
    [UserRole.ADMIN, 'Administrador'],
  ])('traduz %s', (role, expected) => {
    expect(roleLabel(role)).toBe(expected);
  });

  it.each([
    [ProductType.CAR, 'Carros'],
    [ProductType.BOAT, 'Embarcações'],
    [ProductType.AIRCRAFT, 'Aeronaves'],
  ])('traduz %s', (value, expected) => {
    expect(specialityLabel(value)).toBe(expected);
  });

  it.each([
    [
      'CONSULTANT_HAS_CLIENTS' as const,
      'O consultor ainda possui 1 cliente vinculado.',
      'O consultor ainda possui 2 clientes vinculados.',
    ],
    [
      'CONSULTANT_HAS_ADVISEES' as const,
      'O consultor ainda possui 1 assessoria sob sua responsabilidade.',
      'O consultor ainda possui 2 assessorias sob sua responsabilidade.',
    ],
    [
      'SPECIALIST_HAS_ACTIVE_PRODUCTS' as const,
      'O especialista ainda possui 1 produto ativo.',
      'O especialista ainda possui 2 produtos ativos.',
    ],
    [
      'SPECIALIST_HAS_PENDING_APPOINTMENTS' as const,
      'O especialista ainda possui 1 agendamento pendente.',
      'O especialista ainda possui 2 agendamentos pendentes.',
    ],
    [
      'SPECIALIST_HAS_OPEN_PROCESSES' as const,
      'O especialista ainda possui 1 processo em andamento.',
      'O especialista ainda possui 2 processos em andamento.',
    ],
  ])('flexiona bloqueio %s conforme a quantidade', (code, singular, plural) => {
    expect(blockerMessage({ code, count: 1 })).toBe(singular);
    expect(blockerMessage({ code, count: 2 })).toBe(plural);
  });
});
