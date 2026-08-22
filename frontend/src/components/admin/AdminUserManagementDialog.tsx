import { useEffect, useMemo, useRef, useState } from "react";
import {
  blockerMessage,
  ChangeValidationError,
  changeRole,
  changeSpecialistDetails,
  createLatestRequestGuard,
  getManagementDialogInteractionPolicy,
  getDialogRequirements,
  getUserEditMode,
  ROLE_LABELS,
  SPECIALITY_LABELS,
  validateRoleChange,
  validateSpecialistDetailsChange,
  type ChangeRolePayload,
  type ChangeSpecialistDetailsPayload,
  type ChangeValidationResult,
  type SpecialityCode,
  type UserRoleCode,
} from "../../lib/admin-user-management";
import {
  getCompanies,
  type Company,
} from "../../services/companies.service";
import Button from "../ui/button";
import { Alert } from "../ui/alert";
import { Dialog, DialogContent } from "../ui/dialog";

export type AdminUserManagementDialogState = {
  userId: string;
  mode: "role" | "specialist";
  speciality?: SpecialityCode | null;
  commissionRate?: number | null;
};

type Props = {
  state: AdminUserManagementDialogState | null;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
};

type ChangeSnapshot =
  | {
      userId: string;
      mode: "role";
      payload: ChangeRolePayload;
    }
  | {
      userId: string;
      mode: "specialist";
      payload: ChangeSpecialistDetailsPayload;
    };

type ValidatedChange = ChangeSnapshot & {
  requestId: number;
  result: ChangeValidationResult;
};

const ROLE_OPTIONS = Object.entries(ROLE_LABELS) as [UserRoleCode, string][];
const REPLACEMENT_ROLE_OPTIONS = ROLE_OPTIONS.filter(
  ([role]) => role !== "OFFICE",
);
const SPECIALITY_OPTIONS = Object.entries(SPECIALITY_LABELS) as [
  SpecialityCode,
  string,
][];

const selectClassName =
  "block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-60";

export default function AdminUserManagementDialog({
  state,
  onClose,
  onSuccess,
}: Props) {
  const sessionKey = state
    ? `${state.userId}:${state.mode}:${state.speciality ?? ""}:${state.commissionRate ?? ""}`
    : "closed";

  return (
    <AdminUserManagementDialogSession
      key={sessionKey}
      state={state}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}

function AdminUserManagementDialogSession({
  state,
  onClose,
  onSuccess,
}: Props) {
  const [targetRole, setTargetRole] = useState<UserRoleCode | "">(
    state?.mode === "specialist" ? "SPECIALIST" : "",
  );
  const [companyId, setCompanyId] = useState("");
  const [speciality, setSpeciality] = useState<SpecialityCode | "">(
    state?.speciality ?? "",
  );
  const [commissionRate, setCommissionRate] = useState(
    state?.commissionRate?.toString() ?? "",
  );
  const [replacementRole, setReplacementRole] =
    useState<UserRoleCode | "">("");
  const [replacementCompanyId, setReplacementCompanyId] = useState("");
  const [replacementSpeciality, setReplacementSpeciality] =
    useState<SpecialityCode | "">("");
  const [hasOfficeConflict, setHasOfficeConflict] = useState(false);
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [validation, setValidation] =
    useState<ChangeValidationResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestGuard = useRef(createLatestRequestGuard());
  const validatedChange = useRef<ValidatedChange | null>(null);
  const interactionPolicy = getManagementDialogInteractionPolicy(submitting);
  const editMode = getUserEditMode(state?.mode ?? "role", targetRole);

  const requirements = useMemo(
    () =>
      targetRole
        ? getDialogRequirements(targetRole, hasOfficeConflict)
        : [],
    [hasOfficeConflict, targetRole],
  );
  const replacementRequirements = useMemo(
    () =>
      replacementRole ? getDialogRequirements(replacementRole) : [],
    [replacementRole],
  );

  useEffect(() => {
    let ignore = false;
    const needsCompanies =
      editMode === "role" && requirements.includes("company");

    if (!needsCompanies || companies !== null) return;

    setLoadingCompanies(true);
    setError(null);
    getCompanies()
      .then((list) => {
        if (!ignore) setCompanies(list);
      })
      .catch((caught) => {
        if (!ignore) {
          setError(
            (caught as Error).message ||
              "Não foi possível carregar os escritórios.",
          );
        }
      })
      .finally(() => {
        if (!ignore) setLoadingCompanies(false);
      });

    return () => {
      ignore = true;
    };
  }, [companies, editMode, requirements]);

  function reset() {
    requestGuard.current.invalidate();
    validatedChange.current = null;
    setTargetRole("");
    setCompanyId("");
    setSpeciality("");
    setCommissionRate("");
    setReplacementRole("");
    setReplacementCompanyId("");
    setReplacementSpeciality("");
    setHasOfficeConflict(false);
    setCompanies(null);
    setLoadingCompanies(false);
    setValidation(null);
    setVerifying(false);
    setSubmitting(false);
    setError(null);
  }

  function closeDialog() {
    reset();
    onClose();
  }

  function dismiss() {
    if (!interactionPolicy.dismissalAllowed) return;
    closeDialog();
  }

  function invalidateValidation() {
    requestGuard.current.invalidate();
    validatedChange.current = null;
    setValidation(null);
    setVerifying(false);
    setError(null);
  }

  function changeTargetRole(role: UserRoleCode | "") {
    setTargetRole(role);
    setCompanyId("");
    setSpeciality("");
    setCommissionRate("");
    setReplacementRole("");
    setReplacementCompanyId("");
    setReplacementSpeciality("");
    setHasOfficeConflict(false);
    invalidateValidation();
  }

  function applyValidation(
    snapshot: ChangeSnapshot,
    requestId: number,
    result: ChangeValidationResult,
  ) {
    if (!requestGuard.current.isCurrent(requestId)) return;

    const officeConflict = result.blockers.some(
      ({ code }) =>
        code === "OFFICE_REPLACEMENT_REQUIRED" || code === "OFFICE_CONFLICT",
    );
    if (
      snapshot.mode === "role" &&
      snapshot.payload.role === "OFFICE" &&
      officeConflict
    ) {
      setHasOfficeConflict(true);
    }
    validatedChange.current = { ...snapshot, requestId, result };
    setValidation(result);
  }

  function rolePayload(): ChangeRolePayload | null {
    if (!targetRole) {
      setError("Selecione o novo cargo.");
      return null;
    }

    const payload: ChangeRolePayload = { role: targetRole };
    if (requirements.includes("company") && companyId) {
      payload.company_id = companyId;
    }
    if (requirements.includes("speciality") && speciality) {
      payload.speciality = speciality;
    }
    if (requirements.includes("replacement") && replacementRole) {
      payload.replacement = { role: replacementRole };
      if (
        replacementRequirements.includes("company") &&
        replacementCompanyId
      ) {
        payload.replacement.company_id = replacementCompanyId;
      }
      if (
        replacementRequirements.includes("speciality") &&
        replacementSpeciality
      ) {
        payload.replacement.speciality = replacementSpeciality;
      }
    }
    return payload;
  }

  function specialistDetailsPayload(): ChangeSpecialistDetailsPayload | null {
    if (!speciality) {
      setError("Selecione a nova especialidade.");
      return null;
    }
    if (!commissionRate.trim()) {
      setError("Informe a taxa de comissão.");
      return null;
    }
    const rate = Number(commissionRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      setError("A taxa de comissão deve estar entre 0 e 100.");
      return null;
    }
    return { speciality, commission_rate: rate };
  }

  async function verify() {
    if (!state) return;

    const payload =
      editMode === "role" ? rolePayload() : specialistDetailsPayload();
    if (!payload) return;

    const snapshot: ChangeSnapshot =
      editMode === "role"
        ? {
            userId: state.userId,
            mode: "role",
            payload: payload as ChangeRolePayload,
          }
        : {
            userId: state.userId,
            mode: "specialist",
            payload: payload as ChangeSpecialistDetailsPayload,
          };
    const requestId = requestGuard.current.begin();

    setVerifying(true);
    setError(null);
    try {
      const result =
        editMode === "role"
          ? await validateRoleChange(
              state.userId,
              payload as ChangeRolePayload,
            )
          : await validateSpecialistDetailsChange(
              state.userId,
              payload as ChangeSpecialistDetailsPayload,
            );
      applyValidation(snapshot, requestId, result);
    } catch (caught) {
      if (!requestGuard.current.isCurrent(requestId)) return;
      setValidation(null);
      validatedChange.current = null;
      setError((caught as Error).message);
    } finally {
      if (requestGuard.current.isCurrent(requestId)) setVerifying(false);
    }
  }

  async function confirm() {
    const approved = validatedChange.current;
    if (
      !state ||
      !approved?.result.allowed ||
      !requestGuard.current.isCurrent(approved.requestId) ||
      approved.userId !== state.userId ||
      approved.mode !== editMode
    ) {
      return;
    }

    const requestId = requestGuard.current.begin();
    validatedChange.current = { ...approved, requestId };

    setSubmitting(true);
    setError(null);
    try {
      if (approved.mode === "role") {
        await changeRole(approved.userId, approved.payload);
      } else {
        await changeSpecialistDetails(approved.userId, approved.payload);
      }
      if (!requestGuard.current.isCurrent(requestId)) return;
      closeDialog();
      await onSuccess();
    } catch (caught) {
      if (!requestGuard.current.isCurrent(requestId)) return;
      if (caught instanceof ChangeValidationError) {
        applyValidation(approved, requestId, caught.validation);
        setError(null);
      } else {
        setError((caught as Error).message);
      }
      setSubmitting(false);
    }
  }

  const title =
    editMode === "specialist" ? "Editar especialista" : "Alterar cargo";

  return (
    <Dialog
      open={Boolean(state)}
      onOpenChange={(open) => !open && dismiss()}
    >
      <DialogContent
        open={Boolean(state)}
        title={title}
        dismissible={interactionPolicy.dismissalAllowed}
      >
        <fieldset
          className="space-y-4"
          disabled={interactionPolicy.controlsDisabled}
        >
          {state?.mode === "specialist" ? (
            <div>
              <label
                htmlFor="admin-specialist-target-role"
                className="mb-1 block text-sm font-medium text-ink-soft"
              >
                Cargo
              </label>
              <select
                id="admin-specialist-target-role"
                value={targetRole}
                onChange={(event) =>
                  changeTargetRole(event.target.value as UserRoleCode | "")
                }
                className={selectClassName}
              >
                {ROLE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {editMode === "role" ? (
            <>
              {state?.mode === "role" ? (
                <div>
                  <label
                    htmlFor="admin-user-target-role"
                    className="mb-1 block text-sm font-medium text-ink-soft"
                  >
                    Novo cargo
                  </label>
                  <select
                    id="admin-user-target-role"
                    value={targetRole}
                    onChange={(event) =>
                      changeTargetRole(
                        event.target.value as UserRoleCode | "",
                      )
                    }
                    className={selectClassName}
                  >
                    <option value="">Selecione um cargo</option>
                    {ROLE_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {requirements.includes("company") ? (
                <CompanySelect
                  id="admin-user-company"
                  label="Escritório"
                  value={companyId}
                  companies={companies}
                  loading={loadingCompanies}
                  onChange={(value) => {
                    setCompanyId(value);
                    setHasOfficeConflict(false);
                    setReplacementRole("");
                    setReplacementCompanyId("");
                    setReplacementSpeciality("");
                    invalidateValidation();
                  }}
                />
              ) : null}

              {requirements.includes("speciality") ? (
                <SpecialitySelect
                  id="admin-user-role-speciality"
                  label="Especialidade"
                  value={speciality}
                  onChange={(value) => {
                    setSpeciality(value);
                    invalidateValidation();
                  }}
                />
              ) : null}

              {requirements.includes("replacement") ? (
                <fieldset className="space-y-3 rounded-md border border-border p-4">
                  <legend className="px-1 text-sm font-semibold text-ink">
                    Novo cargo do gerente atual
                  </legend>
                  <div>
                    <label
                      htmlFor="admin-user-replacement-role"
                      className="mb-1 block text-sm font-medium text-ink-soft"
                    >
                      Cargo de substituição
                    </label>
                    <select
                      id="admin-user-replacement-role"
                      value={replacementRole}
                      onChange={(event) => {
                        setReplacementRole(
                          event.target.value as UserRoleCode | "",
                        );
                        setReplacementCompanyId("");
                        setReplacementSpeciality("");
                        invalidateValidation();
                      }}
                      className={selectClassName}
                    >
                      <option value="">Selecione um cargo</option>
                      {REPLACEMENT_ROLE_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {replacementRequirements.includes("company") ? (
                    <CompanySelect
                      id="admin-user-replacement-company"
                      label="Escritório do gerente atual"
                      value={replacementCompanyId}
                      companies={companies}
                      loading={loadingCompanies}
                      onChange={(value) => {
                        setReplacementCompanyId(value);
                        invalidateValidation();
                      }}
                    />
                  ) : null}

                  {replacementRequirements.includes("speciality") ? (
                    <SpecialitySelect
                      id="admin-user-replacement-speciality"
                      label="Especialidade do gerente atual"
                      value={replacementSpeciality}
                      onChange={(value) => {
                        setReplacementSpeciality(value);
                        invalidateValidation();
                      }}
                    />
                  ) : null}
                </fieldset>
              ) : null}
            </>
          ) : (
            <>
              <SpecialitySelect
                id="admin-user-speciality"
                label="Nova especialidade"
                value={speciality}
                onChange={(value) => {
                  setSpeciality(value);
                  invalidateValidation();
                }}
              />
              <div>
                <label
                  htmlFor="admin-user-commission-rate"
                  className="mb-1 block text-sm font-medium text-ink-soft"
                >
                  Taxa de comissão (%)
                </label>
                <input
                  id="admin-user-commission-rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={commissionRate}
                  onChange={(event) => {
                    setCommissionRate(event.target.value);
                    invalidateValidation();
                  }}
                  className={selectClassName}
                />
              </div>
            </>
          )}

          {validation?.blockers.length ? (
            <Alert variant="danger">
              {validation.blockers.map(blockerMessage).join(" ")}
            </Alert>
          ) : null}
          {validation?.allowed ? (
            <Alert variant="success">
              Alteração verificada. Você já pode confirmar.
            </Alert>
          ) : null}
          {error ? <Alert variant="danger">{error}</Alert> : null}

          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <Button type="button" variant="light" onClick={dismiss}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="light"
              disabled={verifying || submitting}
              onClick={verify}
            >
              {verifying ? "Verificando..." : "Verificar alteração"}
            </Button>
            <Button
              type="button"
              disabled={!validation?.allowed || submitting || verifying}
              onClick={confirm}
            >
              {submitting ? "Confirmando..." : "Confirmar alteração"}
            </Button>
          </div>
        </fieldset>
      </DialogContent>
    </Dialog>
  );
}

function CompanySelect({
  id,
  label,
  value,
  companies,
  loading,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  companies: Company[] | null;
  loading: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-medium text-ink-soft"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={loading}
        className={selectClassName}
      >
        <option value="">
          {loading ? "Carregando escritórios..." : "Selecione um escritório"}
        </option>
        {(companies ?? []).map((company) => (
          <option key={company.id} value={company.id}>
            {company.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function SpecialitySelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: SpecialityCode | "";
  onChange: (value: SpecialityCode | "") => void;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-medium text-ink-soft"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) =>
          onChange(event.target.value as SpecialityCode | "")
        }
        className={selectClassName}
      >
        <option value="">Selecione uma especialidade</option>
        {SPECIALITY_OPTIONS.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}
