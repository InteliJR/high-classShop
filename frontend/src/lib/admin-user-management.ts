import api from "../services/api";

export type UserRoleCode =
  | "CUSTOMER"
  | "CONSULTANT"
  | "SPECIALIST"
  | "OFFICE"
  | "ADMIN";

export type SpecialityCode = "CAR" | "BOAT" | "AIRCRAFT";

export type ChangeBlockerCode =
  | "ROLE_UNCHANGED"
  | "SPECIALITY_UNCHANGED"
  | "COMPANY_REQUIRED"
  | "COMPANY_NOT_FOUND"
  | "SPECIALITY_REQUIRED"
  | "CUSTOMER_HAS_CONSULTANT"
  | "CUSTOMER_HAS_ADVISOR"
  | "CONSULTANT_HAS_CLIENTS"
  | "CONSULTANT_HAS_ADVISEES"
  | "SPECIALIST_HAS_ACTIVE_PRODUCTS"
  | "SPECIALIST_HAS_PENDING_APPOINTMENTS"
  | "SPECIALIST_HAS_OPEN_PROCESSES"
  | "OFFICE_REPLACEMENT_REQUIRED"
  | "OFFICE_REPLACEMENT_INVALID"
  | "OFFICE_CONFLICT"
  | "CONCURRENT_CHANGE"
  | "LAST_ACTIVE_ADMIN";

export type ChangeBlocker = {
  code: ChangeBlockerCode;
  message: string;
  count?: number;
};

export type ChangeValidationResult = {
  allowed: boolean;
  summary: string;
  blockers: ChangeBlocker[];
};

export class ChangeValidationError extends Error {
  validation: ChangeValidationResult;

  constructor(validation: ChangeValidationResult) {
    super(validation.summary);
    this.name = "ChangeValidationError";
    this.validation = validation;
  }
}

export type RoleContext = {
  role: UserRoleCode;
  company_id?: string;
  speciality?: SpecialityCode;
};

export type ChangeRolePayload = RoleContext & {
  replacement?: RoleContext;
};

export type ChangeSpecialityPayload = {
  speciality: SpecialityCode;
};

export type RecordRowMeta = {
  id: string;
  role?: UserRoleCode;
};

export type RecordsOrigin = {
  entity: string;
  page: number;
};

export type LatestRequestGuard = {
  begin: () => number;
  invalidate: () => void;
  isCurrent: (requestId: number) => boolean;
};

export type ManagementDialogInteractionPolicy = {
  controlsDisabled: boolean;
  dismissalAllowed: boolean;
};

export type DialogRequirement = "company" | "speciality" | "replacement";

export const ROLE_LABELS: Record<UserRoleCode, string> = {
  CUSTOMER: "Cliente",
  CONSULTANT: "Consultor",
  SPECIALIST: "Especialista",
  OFFICE: "Gerente de escritório",
  ADMIN: "Administrador",
};

export const SPECIALITY_LABELS: Record<SpecialityCode, string> = {
  CAR: "Carros",
  BOAT: "Embarcações",
  AIRCRAFT: "Aeronaves",
};

function quantityMessage(
  count: number | undefined,
  singular: string,
  plural: string,
): string {
  const quantity = count ?? 0;
  return `${quantity} ${quantity === 1 ? singular : plural}`;
}

export const BLOCKER_MESSAGES: Record<
  ChangeBlockerCode,
  (count?: number) => string
> = {
  ROLE_UNCHANGED: () => "O cargo selecionado já está atribuído a este usuário.",
  SPECIALITY_UNCHANGED: () =>
    "A especialidade selecionada já está atribuída a este especialista.",
  COMPANY_REQUIRED: () => "Informe o escritório para o cargo selecionado.",
  COMPANY_NOT_FOUND: () => "O escritório informado não foi encontrado.",
  SPECIALITY_REQUIRED: () =>
    "Informe a especialidade para o cargo de Especialista.",
  CUSTOMER_HAS_CONSULTANT: () =>
    "O cliente ainda possui um consultor vinculado.",
  CUSTOMER_HAS_ADVISOR: () => "O cliente ainda possui um assessor vinculado.",
  CONSULTANT_HAS_CLIENTS: (count) =>
    `O consultor ainda possui ${quantityMessage(count, "cliente vinculado", "clientes vinculados")}.`,
  CONSULTANT_HAS_ADVISEES: (count) =>
    `O consultor ainda possui ${quantityMessage(count, "assessoria sob sua responsabilidade", "assessorias sob sua responsabilidade")}.`,
  SPECIALIST_HAS_ACTIVE_PRODUCTS: (count) =>
    `O especialista ainda possui ${quantityMessage(count, "produto ativo", "produtos ativos")}.`,
  SPECIALIST_HAS_PENDING_APPOINTMENTS: (count) =>
    `O especialista ainda possui ${quantityMessage(count, "agendamento pendente", "agendamentos pendentes")}.`,
  SPECIALIST_HAS_OPEN_PROCESSES: (count) =>
    `O especialista ainda possui ${quantityMessage(count, "processo em andamento", "processos em andamento")}.`,
  OFFICE_REPLACEMENT_REQUIRED: () =>
    "Informe o novo cargo do gerente atual do escritório.",
  OFFICE_REPLACEMENT_INVALID: () =>
    "A substituição do gerente de escritório é inválida.",
  OFFICE_CONFLICT: () => "O escritório já possui um gerente ativo.",
  CONCURRENT_CHANGE: () =>
    "Outra alteração foi concluída ao mesmo tempo. Verifique os dados e tente novamente.",
  LAST_ACTIVE_ADMIN: () =>
    "Não é possível remover o último administrador ativo da plataforma.",
};

export function roleLabel(role?: string | null): string {
  return role && role in ROLE_LABELS
    ? ROLE_LABELS[role as UserRoleCode]
    : "Não informado";
}

export function specialityLabel(speciality?: string | null): string {
  return speciality && speciality in SPECIALITY_LABELS
    ? SPECIALITY_LABELS[speciality as SpecialityCode]
    : "Não informado";
}

export function blockerMessage(
  blocker: Pick<ChangeBlocker, "code" | "count">,
): string {
  return BLOCKER_MESSAGES[blocker.code](blocker.count);
}

export function getDialogRequirements(
  role: UserRoleCode,
  hasOfficeConflict = false,
): DialogRequirement[] {
  if (role === "OFFICE")
    return hasOfficeConflict ? ["company", "replacement"] : ["company"];
  if (role === "CONSULTANT") return ["company"];
  if (role === "SPECIALIST") return ["speciality"];
  return [];
}

export function createLatestRequestGuard(): LatestRequestGuard {
  let latestRequestId = 0;

  return {
    begin: () => ++latestRequestId,
    invalidate: () => {
      latestRequestId += 1;
    },
    isCurrent: (requestId) => requestId === latestRequestId,
  };
}

export function getManagementDialogInteractionPolicy(
  submitting: boolean,
): ManagementDialogInteractionPolicy {
  return {
    controlsDisabled: submitting,
    dismissalAllowed: !submitting,
  };
}

export function isSameRecordsOrigin(
  left: RecordsOrigin,
  right: RecordsOrigin,
): boolean {
  return left.entity === right.entity && left.page === right.page;
}

export function shouldInvalidateRecordsRequest(
  current: RecordsOrigin | null,
  next: RecordsOrigin,
): boolean {
  return current === null || !isSameRecordsOrigin(current, next);
}

export async function validateRoleChange(
  id: string,
  payload: ChangeRolePayload,
): Promise<ChangeValidationResult> {
  return requestChange(() =>
    api
      .post<ChangeValidationResult>(
        `admin/database/users/${id}/role-change/validate`,
        payload,
      )
      .then((response) => response.data),
  );
}

export async function changeRole(
  id: string,
  payload: ChangeRolePayload,
): Promise<unknown> {
  return requestChange(() =>
    api
      .patch(`admin/database/users/${id}/role-change`, payload)
      .then((response) => response.data),
  );
}

export async function validateSpecialityChange(
  id: string,
  payload: ChangeSpecialityPayload,
): Promise<ChangeValidationResult> {
  return requestChange(() =>
    api
      .post<ChangeValidationResult>(
        `admin/database/users/${id}/speciality-change/validate`,
        payload,
      )
      .then((response) => response.data),
  );
}

export async function changeSpeciality(
  id: string,
  payload: ChangeSpecialityPayload,
): Promise<unknown> {
  return requestChange(() =>
    api
      .patch(`admin/database/users/${id}/speciality-change`, payload)
      .then((response) => response.data),
  );
}

async function requestChange<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (error) {
    const validation = extractConflictValidation(error);
    if (validation) throw new ChangeValidationError(validation);

    const message =
      typeof error === "object" &&
      error !== null &&
      "friendlyMessage" in error &&
      typeof error.friendlyMessage === "string"
        ? error.friendlyMessage
        : "Não foi possível concluir a alteração. Tente novamente.";
    throw new Error(message);
  }
}

function extractConflictValidation(
  error: unknown,
): ChangeValidationResult | null {
  if (typeof error !== "object" || error === null || !("response" in error)) {
    return null;
  }

  const response = error.response;
  if (typeof response !== "object" || response === null) return null;

  const candidate =
    "status" in response && response.status === 409 && "data" in response
      ? response.data
      : null;
  if (typeof candidate !== "object" || candidate === null) return null;

  if (
    !("allowed" in candidate) ||
    typeof candidate.allowed !== "boolean" ||
    !("summary" in candidate) ||
    typeof candidate.summary !== "string" ||
    !("blockers" in candidate) ||
    !Array.isArray(candidate.blockers)
  ) {
    return null;
  }

  const blockers = candidate.blockers;
  if (
    !blockers.every(
      (blocker) =>
        typeof blocker === "object" &&
        blocker !== null &&
        "code" in blocker &&
        typeof blocker.code === "string" &&
        blocker.code in BLOCKER_MESSAGES &&
        "message" in blocker &&
        typeof blocker.message === "string",
    )
  ) {
    return null;
  }

  return candidate as ChangeValidationResult;
}
