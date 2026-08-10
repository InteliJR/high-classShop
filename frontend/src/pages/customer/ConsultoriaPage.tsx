import { useEffect, useState, useContext } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Car, Ship, Plane, Calendar, UserCircle2, Loader2 } from "lucide-react";
import { PopupModal } from "react-calendly";
import {
  getSpecialistsGroupedByCategory,
  type Specialist,
  type GroupedSpecialists,
} from "../../services/specialists.service";
import { createConsultancyAppointment } from "../../services/appointments.service";
import { AuthContext } from "../../contexts/AuthContext";
import Button from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Alert } from "../../components/ui/alert";
import { EmptyState } from "../../components/patterns/EmptyState";
import ProductTypePreferenceModal, {
  type PreferredProductType,
} from "../../components/product/ProductTypePreferenceModal";
import { useCalendlyScheduling } from "../../hooks/useCalendlyScheduling";

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
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);

  const {
    isModalOpen: isCalendlyModalOpen,
    modalUrl: calendlyModalUrl,
    syncState,
    syncMessage,
    openPopup,
    closePopup,
  } = useCalendlyScheduling({
    successRedirectMessage:
      "Solicitação de consultoria registrada com sucesso! Verifique seus processos.",
  });

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

      openPopup(pendingAppointment.id, formattedUrl);
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
          <Loader2 className="animate-spin w-12 h-12 text-primary" />
          <p className="text-muted">Carregando especialistas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 w-full max-w-6xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-3xl sm:text-4xl font-bold text-ink">
          Consultoria Especializada
        </h1>
        <p className="text-lg text-muted max-w-3xl">
          Nossos especialistas estão prontos para ajudá-lo a encontrar o produto
          perfeito. Escolha um especialista na categoria de seu interesse para
          agendar uma consultoria.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-md bg-brand-primary/10 px-3 py-1 text-sm font-medium text-brand-primary">
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
        {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}

        {syncState !== "idle" && syncMessage && (
          <Alert
            variant={
              syncState === "error"
                ? "danger"
                : syncState === "done"
                  ? "success"
                  : "warning"
            }
          >
            {syncMessage}
          </Alert>
        )}
      </div>

      {/* Specialists by Category */}
      <div className="space-y-12">
        {visibleGroups.map((group) => (
          <div key={group.type} className="space-y-6">
            {/* Category Header */}
            <div className="flex items-center gap-4 border-b-2 border-border pb-4">
              <div className="p-3 bg-brand-primary/10 rounded-full text-brand-primary">
                {group.icon}
              </div>
              <h2 className="text-2xl font-bold text-ink">
                {group.label}
              </h2>
              <span className="text-sm text-muted">
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
              <EmptyState
                icon={UserCircle2}
                title="Nenhum especialista disponível nesta categoria no momento."
              />
            )}
          </div>
        ))}
      </div>

      {calendlyModalUrl && isCalendlyModalOpen && (
        <PopupModal
          url={calendlyModalUrl}
          open={isCalendlyModalOpen}
          onModalClose={closePopup}
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
    <Card className="hover:shadow-lg transition-shadow">
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="p-4 bg-border-soft rounded-full">
          <UserCircle2 size={64} className="text-subtle" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-ink">
            {specialist.name} {specialist.surname}
          </h3>
          <p className="text-sm text-muted">{specialist.email}</p>
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
    </Card>
  );
}
