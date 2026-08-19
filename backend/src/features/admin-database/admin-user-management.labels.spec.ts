import { ProductType, UserRole } from '@prisma/client';
import {
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
});
