import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import {
  browserTimeZone,
  isoToLocalDateTimeInput,
  localDateTimeToIso,
  parseAppointmentIso,
} from "../../lib/appointment-datetime";
import { Alert } from "../ui/alert";
import Button from "../ui/button";
import { Dialog, DialogContent } from "../ui/dialog";

interface AppointmentDateTimeModalProps {
  open: boolean;
  title: string;
  description: string;
  submitLabel: string;
  definitiveWarning?: string;
  initialValue?: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
  busy?: boolean;
  serverError?: string | null;
  onClearServerError?(): void;
  onOpenChange(open: boolean): void;
  onSubmit(appointmentDatetime: string): Promise<void> | void;
}

function submissionErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const candidate = error as { friendlyMessage?: string; message?: string };
    return (
      candidate.friendlyMessage ||
      candidate.message ||
      "Não foi possível confirmar o horário. Tente novamente."
    );
  }

  return "Não foi possível confirmar o horário. Tente novamente.";
}

export default function AppointmentDateTimeModal({
  open,
  title,
  description,
  submitLabel,
  definitiveWarning,
  initialValue,
  returnFocusRef,
  busy = false,
  serverError,
  onClearServerError,
  onOpenChange,
  onSubmit,
}: AppointmentDateTimeModalProps) {
  let initialLocalValue = "";
  try {
    if (initialValue) initialLocalValue = isoToLocalDateTimeInput(initialValue);
  } catch {
    // A legacy malformed proposal must still allow the specialist to choose a time.
  }
  const [localDateTime, setLocalDateTime] = useState(initialLocalValue);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const focusTarget = useRef<HTMLElement | null>(null);
  const focusCaptured = useRef(false);
  const latestOpen = useRef(open);
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const timeZoneId = `${fieldId}-timezone`;
  const isBusy = busy || submitting;
  const errorMessage = validationError || serverError;

  useLayoutEffect(() => {
    latestOpen.current = open;
  }, [open]);

  useEffect(() => {
    setLocalDateTime(open ? initialLocalValue : "");
    setValidationError(null);
  }, [open, initialValue, initialLocalValue]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isBusy) onOpenChange(nextOpen);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);

    try {
      let appointmentDatetime: string;
      if (initialValue && initialLocalValue && localDateTime === initialLocalValue) {
        if (parseAppointmentIso(initialValue).getTime() <= Date.now()) {
          throw new Error("Selecione uma data e hora futuras");
        }
        appointmentDatetime = initialValue;
      } else {
        appointmentDatetime = localDateTimeToIso(localDateTime);
      }
      setValidationError(null);
      await onSubmit(appointmentDatetime);
    } catch (error) {
      setValidationError(submissionErrorMessage(error));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        open={open}
        title={title}
        dismissible={!isBusy}
        onOpenAutoFocus={() => {
          if (!focusCaptured.current) {
            focusTarget.current = returnFocusRef?.current ||
              (document.activeElement instanceof HTMLElement ? document.activeElement : null);
            focusCaptured.current = true;
          }
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (latestOpen.current) return;
          const target = returnFocusRef?.current || focusTarget.current;
          if (target?.isConnected) target.focus();
          focusCaptured.current = false;
          focusTarget.current = null;
        }}
        className="max-w-md"
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <p className="text-sm text-ink-soft">{description}</p>

          {definitiveWarning && (
            <Alert variant="warning">{definitiveWarning}</Alert>
          )}

          {errorMessage && (
            <Alert variant="danger" id={errorId}>{errorMessage}</Alert>
          )}

          <div>
            <label
              htmlFor={fieldId}
              className="mb-2 block text-sm font-medium text-ink"
            >
              Data e hora
            </label>
            <input
              id={fieldId}
              type="datetime-local"
              value={localDateTime}
              disabled={isBusy}
              aria-invalid={errorMessage ? true : undefined}
              aria-describedby={`${timeZoneId}${errorMessage ? ` ${errorId}` : ""}`}
              onChange={(event) => {
                setLocalDateTime(event.target.value);
                setValidationError(null);
                onClearServerError?.();
              }}
              className="w-full rounded-lg border border-border px-3 py-2 text-ink focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <p id={timeZoneId} className="mt-2 text-xs text-ink-soft">
              Fuso horário: <span>{browserTimeZone()}</span>
            </p>
          </div>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="light"
              disabled={isBusy}
              onClick={() => handleOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isBusy || !localDateTime} aria-busy={isBusy}>
              {submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
