import { useEffect, useState, type FormEvent } from "react";
import {
  browserTimeZone,
  localDateTimeToIso,
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
  busy?: boolean;
  serverError?: string | null;
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
  busy = false,
  serverError,
  onOpenChange,
  onSubmit,
}: AppointmentDateTimeModalProps) {
  const [localDateTime, setLocalDateTime] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setLocalDateTime("");
      setValidationError(null);
    }
  }, [open]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!busy) onOpenChange(nextOpen);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const appointmentDatetime = localDateTimeToIso(localDateTime);
      setValidationError(null);
      await onSubmit(appointmentDatetime);
    } catch (error) {
      setValidationError(submissionErrorMessage(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        open={open}
        title={title}
        dismissible={!busy}
        className="max-w-md"
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <p className="text-sm text-ink-soft">{description}</p>

          {definitiveWarning && (
            <Alert variant="warning">{definitiveWarning}</Alert>
          )}

          {(validationError || serverError) && (
            <Alert variant="danger">{validationError || serverError}</Alert>
          )}

          <div>
            <label
              htmlFor="appointment-datetime"
              className="mb-2 block text-sm font-medium text-ink"
            >
              Data e hora
            </label>
            <input
              id="appointment-datetime"
              type="datetime-local"
              value={localDateTime}
              disabled={busy}
              onChange={(event) => {
                setLocalDateTime(event.target.value);
                setValidationError(null);
              }}
              className="w-full rounded-lg border border-border px-3 py-2 text-ink focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <p className="mt-2 text-xs text-ink-soft">
              Fuso horário: <span>{browserTimeZone()}</span>
            </p>
          </div>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="light"
              disabled={busy}
              onClick={() => handleOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={busy || !localDateTime}>
              {submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
