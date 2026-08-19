import { ProductType, UserRole } from '@prisma/client';
import {
  ChangeBlocker,
  ChangeBlockerCode,
} from './admin-user-management.types';

const roleLabels: Record<UserRole, string> = {
  [UserRole.CUSTOMER]: 'Cliente',
  [UserRole.CONSULTANT]: 'Consultor',
  [UserRole.SPECIALIST]: 'Especialista',
  [UserRole.OFFICE]: 'Gerente de escritório',
  [UserRole.ADMIN]: 'Administrador',
};

const specialityLabels: Record<ProductType, string> = {
  [ProductType.CAR]: 'Carros',
  [ProductType.BOAT]: 'Embarcações',
  [ProductType.AIRCRAFT]: 'Aeronaves',
};

export function roleLabel(role: UserRole): string {
  return roleLabels[role];
}

export function specialityLabel(speciality: ProductType): string {
  return specialityLabels[speciality];
}

export function blockerMessage(blocker: Pick<ChangeBlocker, 'code' | 'count'>): string {
  return blockerMessages[blocker.code](blocker.count);
}

const blockerMessages: Record<ChangeBlockerCode, (count?: number) => string> = {
  ROLE_UNCHANGED: () => 'O cargo selecionado já está atribuído a este usuário.',
  SPECIALITY_UNCHANGED: () => 'A especialidade selecionada já está atribuída a este especialista.',
  COMPANY_REQUIRED: () => 'Informe o escritório para o cargo selecionado.',
  COMPANY_NOT_FOUND: () => 'O escritório informado não foi encontrado.',
  SPECIALITY_REQUIRED: () => 'Informe a especialidade para o cargo de Especialista.',
  CUSTOMER_HAS_CONSULTANT: () => 'O cliente ainda possui um consultor vinculado.',
  CUSTOMER_HAS_ADVISOR: () => 'O cliente ainda possui um assessor vinculado.',
  CONSULTANT_HAS_CLIENTS: (count) => `O consultor ainda possui ${count ?? 0} clientes vinculados.`,
  CONSULTANT_HAS_ADVISEES: (count) => `O consultor ainda possui ${count ?? 0} assessorias sob sua responsabilidade.`,
  SPECIALIST_HAS_ACTIVE_PRODUCTS: (count) => `O especialista ainda possui ${count ?? 0} produtos ativos.`,
  SPECIALIST_HAS_PENDING_APPOINTMENTS: (count) => `O especialista ainda possui ${count ?? 0} agendamentos pendentes.`,
  SPECIALIST_HAS_OPEN_PROCESSES: (count) => `O especialista ainda possui ${count ?? 0} processos em andamento.`,
  OFFICE_REPLACEMENT_REQUIRED: () => 'Informe o novo cargo do gerente atual do escritório.',
  OFFICE_REPLACEMENT_INVALID: () => 'A substituição do gerente de escritório é inválida.',
  OFFICE_CONFLICT: () => 'O escritório já possui um gerente ativo.',
  LAST_ACTIVE_ADMIN: () => 'Não é possível remover o último administrador ativo da plataforma.',
};
