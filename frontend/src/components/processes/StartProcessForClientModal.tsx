import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PopupModal, useCalendlyEventListener } from "react-calendly";
import { getClients, createConsultantProcess, type Client } from "../../services/consultant.service";
import { officeService } from "../../services/office";
import { getPublicSpecialistById, type PublicSpecialistProfile } from "../../services/specialists.service";
import {
  registerCalendlyScheduledEvent,
  getCalendlySyncStatus,
} from "../../services/appointments.service";
import Button from "../../components/ui/button";
import { Loader2, Search } from "lucide-react";

/**
 * Consultor e gerente de escritório abrem processo em nome de um cliente pelo
 * mesmo fluxo; o que muda é de onde vem a lista de clientes, qual endpoint
 * cria o processo e para onde o usuário volta depois.
 */
const MODES = {
  CONSULTANT: {
    listClients: () => getClients(),
    createProcess: createConsultantProcess,
    redirectTo: "/consultant/processes",
    emptyMessage:
      'Você ainda não tem clientes. Convide um cliente primeiro em "Meus Clientes".',
  },
  OFFICE: {
    listClients: () => officeService.listClients(),
    createProcess: officeService.createProcess,
    redirectTo: "/office/processes",
    emptyMessage:
      "Nenhum cliente vinculado ao escritório ainda.",
  },
} as const;

interface Props {
  productType: "CAR" | "BOAT" | "AIRCRAFT";
  productId: string;
  specialistId: string;
  productLabel?: string;
  mode?: keyof typeof MODES;
  onClose: () => void;
  onBusyChange?(busy: boolean): void;
  calendlyRootElement: HTMLElement | null;
  onCalendlyOpenChange?(open: boolean): void;
}

export default function StartProcessForClientModal(props: Props) {
  const mode = props.mode ?? "CONSULTANT";
  const scope = JSON.stringify([mode, props.specialistId, props.productType, props.productId]);
  return <StartProcessForClientModalInner key={scope} {...props} mode={mode} />;
}

function StartProcessForClientModalInner({
  productType,
  productId,
  specialistId,
  productLabel,
  mode = "CONSULTANT",
  onClose,
  onBusyChange,
  calendlyRootElement,
  onCalendlyOpenChange,
}: Props) {
  const config = MODES[mode];
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Calendly
  const [specialistProfile, setSpecialistProfile] = useState<PublicSpecialistProfile | null>(null);
  const [isLoadingSpecialist, setIsLoadingSpecialist] = useState(true);
  const [specialistError, setSpecialistError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const mountedRef = useRef(false);
  const operationGeneration = useRef(0);
  const busyCallbackRef = useRef(onBusyChange);
  const calendlyOpenCallbackRef = useRef(onCalendlyOpenChange);
  const [pendingOperation, setPendingOperation] = useState<{
    appointmentId: string;
    generation: number;
    client: Client;
  } | null>(null);
  const [calendlyUrl, setCalendlyUrl] = useState<string | null>(null);
  const [isCalendlyOpen, setIsCalendlyOpen] = useState(false);
  const [calendlyMessage, setCalendlyMessage] = useState<string | null>(null);

  useLayoutEffect(() => {
    busyCallbackRef.current = onBusyChange;
    calendlyOpenCallbackRef.current = onCalendlyOpenChange;
  }, [onBusyChange, onCalendlyOpenChange]);

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      operationGeneration.current += 1;
      calendlyOpenCallbackRef.current?.(false);
      busyCallbackRef.current?.(false);
    };
  }, []);

  const isCurrentOperation = (generation: number) =>
    mountedRef.current && operationGeneration.current === generation;

  const setBusy = (busy: boolean) => {
    setIsSubmitting(busy);
    busyCallbackRef.current?.(busy);
  };

  const setCalendlyOpen = (open: boolean) => {
    setIsCalendlyOpen(open);
    calendlyOpenCallbackRef.current?.(open);
  };

  useEffect(() => {
    let active = true;
    setClients([]);
    setSelectedClient(null);
    setIsLoadingClients(true);
    config
      .listClients()
      .then((list) => { if (active) setClients(list as Client[]); })
      .catch(() => { if (active) setClients([]); })
      .finally(() => { if (active) setIsLoadingClients(false); });
    searchRef.current?.focus();
    // MODES é constante de módulo, então `config` só muda se `mode` mudar —
    // não recarrega a lista a cada render.
    return () => { active = false; };
  }, [config]);

  // Carrega o link do Calendly do especialista para permitir agendar a reunião
  useEffect(() => {
    let active = true;
    setSpecialistProfile(null);
    setSpecialistError(null);
    setIsLoadingSpecialist(true);
    getPublicSpecialistById(specialistId)
      .then((profile) => { if (active) setSpecialistProfile(profile); })
      .catch(() => { if (active) setSpecialistError("Não foi possível carregar o especialista. Tente novamente."); })
      .finally(() => { if (active) setIsLoadingSpecialist(false); });
    return () => { active = false; };
  }, [specialistId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      `${c.name} ${c.surname} ${c.email ?? ""}`.toLowerCase().includes(q),
    );
  }, [clients, search]);

  // Sincroniza o horário escolhido no Calendly com o agendamento criado
  useCalendlyEventListener({
    onEventScheduled: async (event) => {
      const pending = pendingOperation;
      if (!pending || !isCurrentOperation(pending.generation)) return;

      const payload = (event as any)?.data?.payload;
      const eventUri = payload?.event?.uri;
      const inviteeUri = payload?.invitee?.uri;

      try {
        if (eventUri && inviteeUri) {
          await registerCalendlyScheduledEvent(pending.appointmentId, {
            event_uri: eventUri,
            invitee_uri: inviteeUri,
            client_event: "calendly.event_scheduled",
            client_observed_at: new Date().toISOString(),
          });
          if (!isCurrentOperation(pending.generation)) return;
          // Best-effort: garante que o status foi consultado antes de seguir
          await getCalendlySyncStatus(pending.appointmentId).catch(() => null);
          if (!isCurrentOperation(pending.generation)) return;
        }
      } catch (err) {
        if (isCurrentOperation(pending.generation)) {
          console.error("Erro ao sincronizar evento do Calendly:", err);
        }
      } finally {
        if (isCurrentOperation(pending.generation)) {
          operationGeneration.current += 1;
          setCalendlyOpen(false);
          setPendingOperation(null);
          submittingRef.current = false;
          setBusy(false);
          navigate(config.redirectTo);
        }
      }
    },
  });

  const handleSubmit = async () => {
    if (submittingRef.current || isLoadingSpecialist || specialistError ||
      !specialistProfile || specialistProfile.id !== specialistId) return;
    if (!selectedClient) {
      setError("Selecione um cliente.");
      return;
    }
    setError(null);
    const specialistCalendlyUrl = specialistProfile.calendly_url?.trim();
    if (specialistProfile.calendly_scheduling_available && !specialistCalendlyUrl) {
      setError("O link do Calendly não está disponível. Tente novamente.");
      return;
    }
    submittingRef.current = true;
    const generation = ++operationGeneration.current;
    const submittedClient = selectedClient;
    let awaitingCalendly = false;
    setBusy(true);
    try {
      const process = await config.createProcess({
        client_id: submittedClient.id,
        specialist_id: specialistId,
        product_type: productType,
        product_id: productId,
      });
      if (!isCurrentOperation(generation)) return;

      // Se o especialista tem Calendly, abre o popup para marcar o horário.
      // Sem Calendly, segue o fluxo antigo (agendamento definido depois).
      if (specialistProfile.calendly_scheduling_available && specialistCalendlyUrl && process.appointment_id) {
        let url = specialistCalendlyUrl.trim();
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
          url = `https://${url}`;
        }
        awaitingCalendly = true;
        setPendingOperation({ appointmentId: process.appointment_id, generation, client: submittedClient });
        setCalendlyUrl(url);
        setCalendlyOpen(true);
        setCalendlyMessage(
          "Conclua o agendamento no Calendly para marcar o horário da reunião.",
        );
      } else {
        navigate(config.redirectTo);
      }
    } catch (err) {
      if (isCurrentOperation(generation)) {
        setError((err as Error).message || "Erro ao criar processo. Tente novamente.");
      }
    } finally {
      if (isCurrentOperation(generation) && !awaitingCalendly) {
        submittingRef.current = false;
        setBusy(false);
      }
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="h2-style">Iniciar processo para cliente</h2>
        {productLabel && (
          <p className="text-sm text-gray-500 mt-1">
            Produto: <strong>{productLabel}</strong>
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Selecione o cliente
        </label>
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>

        {isLoadingClients ? (
          <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Carregando clientes...</span>
          </div>
        ) : clients.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            {config.emptyMessage}
          </p>
        ) : (
          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-400 px-3 py-2">Nenhum cliente encontrado.</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setSelectedClient(c)}
                  className={`w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors ${
                    selectedClient?.id === c.id ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="text-sm font-medium text-gray-900">
                    {c.name} {c.surname}
                  </div>
                  <div className="text-xs text-gray-400">{c.email}</div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {specialistError && <p role="alert" className="text-sm text-red-500">{specialistError}</p>}
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      {calendlyMessage && (
        <p className="text-sm text-blue-600">{calendlyMessage}</p>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" onClick={() => {
          if (submittingRef.current) return;
          operationGeneration.current += 1;
          onClose();
        }} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || !selectedClient || isLoadingClients || isLoadingSpecialist || Boolean(specialistError) || specialistProfile?.id !== specialistId}
        >
          {isSubmitting ? "Criando..." : "Criar processo"}
        </Button>
      </div>

      {calendlyRootElement && calendlyUrl && isCalendlyOpen && (
        <PopupModal
          url={calendlyUrl}
          open={isCalendlyOpen}
          onModalClose={() => {
            if (!pendingOperation || !isCurrentOperation(pendingOperation.generation)) return;
            operationGeneration.current += 1;
            setCalendlyOpen(false);
            setPendingOperation(null);
            submittingRef.current = false;
            setBusy(false);
            navigate(config.redirectTo);
          }}
          rootElement={calendlyRootElement}
          prefill={{
            name: pendingOperation
              ? `${pendingOperation.client.name} ${pendingOperation.client.surname}`.trim()
              : undefined,
            email: pendingOperation?.client.email,
          }}
        />
      )}
    </div>
  );
}
