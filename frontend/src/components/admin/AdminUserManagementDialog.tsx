import { useEffect, useMemo, useState } from "react";
import {
  blockerMessage,
  changeRole,
  changeSpeciality,
  getDialogRequirements,
  ROLE_LABELS,
  SPECIALITY_LABELS,
  validateRoleChange,
  validateSpecialityChange,
  type ChangeRolePayload,
  type ChangeSpecialityPayload,
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
  mode: "role" | "speciality";
};

type Props = {
  state: AdminUserManagementDialogState | null;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
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
  const [targetRole, setTargetRole] = useState<UserRoleCode | "">("");
  const [companyId, setCompanyId] = useState("");
  const [speciality, setSpeciality] = useState<SpecialityCode | "">("");
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
      state?.mode === "role" && requirements.includes("company");

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
  }, [companies, requirements, state?.mode]);

  function reset() {
    setTargetRole("");
    setCompanyId("");
    setSpeciality("");
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

  function close() {
    reset();
    onClose();
  }

  function invalidateValidation() {
    setValidation(null);
    setError(null);
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

  function specialityPayload(): ChangeSpecialityPayload | null {
    if (!speciality) {
      setError("Selecione a nova especialidade.");
      return null;
    }
    return { speciality };
  }

  async function verify() {
    if (!state) return;

    const payload =
      state.mode === "role" ? rolePayload() : specialityPayload();
    if (!payload) return;

    setVerifying(true);
    setError(null);
    try {
      const result =
        state.mode === "role"
          ? await validateRoleChange(
              state.userId,
              payload as ChangeRolePayload,
            )
          : await validateSpecialityChange(
              state.userId,
              payload as ChangeSpecialityPayload,
            );
      const officeConflict = result.blockers.some(
        ({ code }) =>
          code === "OFFICE_REPLACEMENT_REQUIRED" ||
          code === "OFFICE_CONFLICT",
      );
      if (targetRole === "OFFICE" && officeConflict) {
        setHasOfficeConflict(true);
      }
      setValidation(result);
    } catch (caught) {
      setValidation(null);
      setError((caught as Error).message);
    } finally {
      setVerifying(false);
    }
  }

  async function confirm() {
    if (!state || !validation?.allowed) return;

    const payload =
      state.mode === "role" ? rolePayload() : specialityPayload();
    if (!payload) return;

    setSubmitting(true);
    setError(null);
    try {
      if (state.mode === "role") {
        await changeRole(state.userId, payload as ChangeRolePayload);
      } else {
        await changeSpeciality(
          state.userId,
          payload as ChangeSpecialityPayload,
        );
      }
      close();
      await onSuccess();
    } catch (caught) {
      setError((caught as Error).message);
      setSubmitting(false);
    }
  }

  const title =
    state?.mode === "speciality" ? "Alterar especialidade" : "Alterar cargo";

  return (
    <Dialog open={Boolean(state)} onOpenChange={(open) => !open && close()}>
      <DialogContent open={Boolean(state)} title={title}>
        <div className="space-y-4">
          {state?.mode === "role" ? (
            <>
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
                  onChange={(event) => {
                    setTargetRole(event.target.value as UserRoleCode | "");
                    setCompanyId("");
                    setSpeciality("");
                    setReplacementRole("");
                    setReplacementCompanyId("");
                    setReplacementSpeciality("");
                    setHasOfficeConflict(false);
                    invalidateValidation();
                  }}
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
            <SpecialitySelect
              id="admin-user-speciality"
              label="Nova especialidade"
              value={speciality}
              onChange={(value) => {
                setSpeciality(value);
                invalidateValidation();
              }}
            />
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
            <Button type="button" variant="light" onClick={close}>
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
        </div>
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
