import { useId, useRef, useState, type FormEvent } from "react";
import { Dialog, DialogContent } from "../ui/dialog";
import { Alert } from "../ui/alert";
import Button from "../ui/button";

interface ConsultancyRequestModalProps {
  specialistName: string;
  onClose(): void;
  onSubmit(reason: string): Promise<void>;
}

export default function ConsultancyRequestModal({
  specialistName,
  onClose,
  onSubmit,
}: ConsultancyRequestModalProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const trigger = useRef<HTMLElement | null>(
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    const trimmed = reason.trim();
    if (!trimmed || trimmed.length > 500) {
      setError(
        !trimmed
          ? "Informe o motivo da consultoria."
          : "O motivo deve ter no máximo 500 caracteres.",
      );
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await onSubmit(trimmed);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível enviar a solicitação. Tente novamente.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        open
        title="Solicitar consultoria"
        dismissible={!busy}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (trigger.current?.isConnected) trigger.current.focus();
        }}
      >
        <form noValidate className="space-y-4" onSubmit={submit}>
          <p className="text-sm text-ink-soft">
            Especialista: <strong>{specialistName}</strong>
          </p>
          <div>
            <label
              htmlFor={fieldId}
              className="mb-2 block text-sm font-medium text-ink"
            >
              Comente brevemente sobre o motivo dessa conversa
            </label>
            <textarea
              id={fieldId}
              required
              rows={4}
              maxLength={500}
              value={reason}
              disabled={busy}
              aria-invalid={error ? true : undefined}
              aria-describedby={`${hintId}${error ? ` ${errorId}` : ""}`}
              onChange={(event) => {
                setReason(event.target.value);
                setError("");
              }}
              className="w-full rounded-lg border border-border px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-brand-primary/20 disabled:opacity-60"
            />
            <p id={hintId} className="mt-1 text-xs text-ink-soft">
              Obrigatório. {reason.length}/500 caracteres.
            </p>
          </div>
          {error && (
            <Alert id={errorId} variant="danger">
              {error}
            </Alert>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="light"
              disabled={busy}
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={busy} aria-busy={busy}>
              {busy ? "Enviando..." : "Enviar solicitação"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
