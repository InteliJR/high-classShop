import { useEffect, useState, useContext } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Car, Ship, Plane, Calendar, UserCircle2, Loader2 } from "lucide-react";
import { PopupModal, useCalendlyEventListener } from "react-calendly";
import {
  getSpecialistsGroupedByCategory,
  type Specialist,
  type GroupedSpecialists,
} from "../../services/specialists.service";
import {
  createConsultancyAppointment,
  getCalendlySyncStatus,
  registerCalendlyScheduledEvent,
} from "../../services/appointments.service";
import { AuthContext } from "../../contexts/AuthContext";
import Button from "../../components/ui/button";
import ProductTypePreferenceModal, {
  type PreferredProductType,
} from "../../components/ProductTypePreferenceModal";

type SpecialityType = "CAR" | "BOAT" | "AIRCRAFT";

interface SpecialistGroup {
  type: SpecialityType;
  label: string;
  icon: React.ReactNode;
  specialists: Specialist[];
}

const specialityConfig: Record<
  SpecialityType,
  { label: string; icon: React.ReactNode }
> = {
  CAR: { label: "Carros", icon: <Car size={28} /> },
  BOAT: { label: "Embarcações", icon: <Ship size={28} /> },
  AIRCRAFT: { label: "Aeronaves", icon: <Plane size={28} /> },
};

export default function ConsultoriaPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useContext(AuthContext);
  const [groupedSpecialists, setGroupedSpecialists] =
    useState<GroupedSpecialists | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestingSpecialistId, setRequestingSpecialistId] = useState<
    string | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isCalendlyModalOpen, setIsCalendlyModalOpen] = useState(false);
  const [calendlyModalUrl, setCalendlyModalUrl] = useState<string | null>(null);
  const [pendingAppointmentId, setPendingAppointmentId] = useState<
    string | null
  >(null);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncState, setSyncState] = useState<
    "idle" | "waiting_event" | "syncing" | "done" | "error"
  >("idle");
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);

  const typeFromUrl = searchParams.get("type") as PreferredProductType | null;
  const selectedType: PreferredProductType | null =
    typeFromUrl && ["CAR", "BOAT", "AIRCRAFT"].includes(typeFromUrl)
      ? typeFromUrl
      : null;

  useEffect(() => {
    if (!selectedType) {
      setIsTypeModalOpen(true);
    }
  }, [selectedType]);

  useEffect(() => {
    async function fetchSpecialists() {
      try {
        const data = await getSpecialistsGroupedByCategory();
        setGroupedSpecialists(data);
      } catch (error) {
        console.error("Erro ao buscar especialistas:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchSpecialists();
  }, []);

  // Transform grouped data into display format
  const specialistGroups: SpecialistGroup[] = groupedSpecialists
    ? (["CAR", "BOAT", "AIRCRAFT"] as SpecialityType[]).map((type) => ({
        type,
        label: specialityConfig[type].label,
        icon: specialityConfig[type].icon,
        specialists: groupedSpecialists[type] || [],
      }))
    : [];

  const visibleGroups = selectedType
    ? specialistGroups.filter((group) => group.type === selectedType)
    : specialistGroups;

  const selectedTypeLabel = selectedType
    ? specialityConfig[selectedType].label
    : null;

  const handleSelectConsultancyType = (type: PreferredProductType) => {
    setSearchParams({ type });
    setIsTypeModalOpen(false);
  };

  const pollCalendlySyncStatus = async (appointmentId: string) => {
    const maxAttempts = 8;
    const intervalMs = 3500;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const syncStatus = await getCalendlySyncStatus(appointmentId);

      if (
        syncStatus.calendly_sync_status === "SYNCED" ||
        syncStatus.appointment_datetime
      ) {
        setSyncState("done");
        setSyncMessage(
          "Agendamento recebido! Você pode acompanhar os detalhes em Meus Processos."
        );

        setTimeout(() => {
          navigate("/customer/processes", {
            state: {
              message:
                "Solicitação de consultoria registrada com sucesso! Verifique seus processos.",
            },
          });
        }, 900);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    setSyncState("done");
    setSyncMessage(
      "Solicitação registrada. Estamos finalizando a sincronização do horário com o calendário."
    );
  };

  useCalendlyEventListener({
    onEventScheduled: async (event) => {
      if (!pendingAppointmentId) {
        return;
      }

      const payload = (event as any)?.data?.payload;
      const eventUri = payload?.event?.uri;
      const inviteeUri = payload?.invitee?.uri;

      if (!eventUri || !inviteeUri) {
        setSyncState("error");
        setSyncMessage(
          "Não foi possível capturar os dados do agendamento. Verifique seus processos para confirmar."
        );
        return;
      }

      try {
        setSyncState("syncing");
        setSyncMessage("Sincronizando seu agendamento...");

        await registerCalendlyScheduledEvent(pendingAppointmentId, {
          event_uri: eventUri,
          invitee_uri: inviteeUri,
          client_event: "calendly.event_scheduled",
          client_observed_at: new Date().toISOString(),
        });

        setIsCalendlyModalOpen(false);
        await pollCalendlySyncStatus(pendingAppointmentId);
      } catch (error) {
        console.error("Erro ao sincronizar evento do Calendly:", error);
        setSyncState("error");
        setSyncMessage(
          "Agendamento criado, mas houve falha na sincronização automática. Você pode seguir em Meus Processos."
        );
      }
    },
  });

  const handleRequestMeeting = async (specialist: Specialist) => {
    if (!user || requestingSpecialistId) return;

    setRequestingSpecialistId(specialist.id);
    setErrorMessage("");

    try {
      const pendingAppointment = await createConsultancyAppointment({
        client_id: user.id,
        specialist_id: specialist.id,
        notes: `Consultoria solicitada pelo cliente`,
      });

      const rawCalendlyUrl = specialist.calendly_url?.trim();
      if (!rawCalendlyUrl) {
        navigate("/customer/processes", {
          state: {
            message:
              "Solicitação enviada. O especialista entrará em contato para definir o horário.",
          },
        });
        return;
      }

      const formattedUrl = /^https?:\/\//i.test(rawCalendlyUrl)
        ? rawCalendlyUrl
        : `https://${rawCalendlyUrl}`;

      setPendingAppointmentId(pendingAppointment.id);
      setCalendlyModalUrl(formattedUrl);
      setSyncState("waiting_event");
      setSyncMessage(
        "Conclua seu agendamento no Calendly para sincronizar automaticamente com a plataforma."
      );
      setIsCalendlyModalOpen(true);
    } catch (error: any) {
      const message =
        error?.response?.data?.error?.message ||
        error?.message ||
        "Erro ao solicitar agendamento. Tente novamente.";
      setErrorMessage(message);
    } finally {
      setRequestingSpecialistId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-3 border-gray-200 border-t-primary rounded-full animate-spin" />
          <p className="text-gray-600">Carregando especialistas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 w-full max-w-6xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
          Consultoria Especializada
        </h1>
        <p className="text-lg text-gray-600 max-w-3xl">
          Nossos especialistas estão prontos para ajudá-lo a encontrar o produto
          perfeito. Escolha um especialista na categoria de seu interesse para
          agendar uma consultoria.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-md bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            {selectedTypeLabel
              ? `Consultoria de ${selectedTypeLabel}`
              : "Selecione uma categoria"}
          </span>
          <Button
            onClick={() => setIsTypeModalOpen(true)}
            variant="light"
            className="text-sm"
          >
            Trocar categoria
          </Button>
        </div>
        {errorMessage && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {syncState !== "idle" && syncMessage && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              syncState === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : syncState === "done"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {syncMessage}
          </div>
        )}
      </div>

      {/* Specialists by Category */}
      <div className="space-y-12">
        {visibleGroups.map((group) => (
          <div key={group.type} className="space-y-6">
            {/* Category Header */}
            <div className="flex items-center gap-4 border-b-2 border-gray-200 pb-4">
              <div className="p-3 bg-primary/10 rounded-full text-primary">
                {group.icon}
              </div>
              <h2 className="text-2xl font-bold text-gray-900">
                {group.label}
              </h2>
              <span className="text-sm text-gray-500">
                ({group.specialists.length} especialista
                {group.specialists.length !== 1 ? "s" : ""})
              </span>
            </div>

            {/* Specialists Grid */}
            {group.specialists.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {group.specialists.map((specialist) => (
                  <SpecialistCard
                    key={specialist.id}
                    specialist={specialist}
                    onRequestMeeting={handleRequestMeeting}
                    isRequesting={requestingSpecialistId === specialist.id}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl">
                Nenhum especialista disponível nesta categoria no momento.
              </div>
            )}
          </div>
        ))}
      </div>

      {calendlyModalUrl && isCalendlyModalOpen && (
        <PopupModal
          url={calendlyModalUrl}
          open={isCalendlyModalOpen}
          onModalClose={() => setIsCalendlyModalOpen(false)}
          rootElement={document.getElementById("root") ?? document.body}
          prefill={{
            name: user ? `${user.name} ${user.surname}`.trim() : undefined,
            email: user?.email,
          }}
        />
      )}

      <ProductTypePreferenceModal
        isOpen={isTypeModalOpen}
        title="Qual tipo de consultoria você deseja?"
        description="Escolha a categoria para ver especialistas da área certa."
        onClose={() => {
          if (selectedType) {
            setIsTypeModalOpen(false);
          }
        }}
        onSelect={handleSelectConsultancyType}
      />
    </div>
  );
}

interface SpecialistCardProps {
  specialist: Specialist;
  onRequestMeeting: (specialist: Specialist) => Promise<void>;
  isRequesting: boolean;
}

function SpecialistCard({
  specialist,
  onRequestMeeting,
  isRequesting,
}: SpecialistCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="p-4 bg-gray-100 rounded-full">
          <UserCircle2 size={64} className="text-gray-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {specialist.name} {specialist.surname}
          </h3>
          <p className="text-sm text-gray-500">{specialist.email}</p>
        </div>
        <Button
          onClick={() => onRequestMeeting(specialist)}
          className="w-full flex items-center justify-center gap-2"
          variant="solid"
          disabled={isRequesting}
        >
          {isRequesting ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Solicitando...
            </>
          ) : (
            <>
              <Calendar size={18} />
              Solicitar Reunião
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
