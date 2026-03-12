import { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { Car, Ship, Plane, Calendar, UserCircle2, ExternalLink, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { getSpecialistsGroupedByCategory, type Specialist, type GroupedSpecialists } from "../../services/specialists.service";
import { createConsultancyAppointment } from "../../services/appointments.service";
import { AuthContext } from "../../contexts/AuthContext";
import Button from "../../components/ui/button";

type SpecialityType = "CAR" | "BOAT" | "AIRCRAFT";

interface SpecialistGroup {
  type: SpecialityType;
  label: string;
  icon: React.ReactNode;
  specialists: Specialist[];
}

const specialityConfig: Record<SpecialityType, { label: string; icon: React.ReactNode }> = {
  CAR: { label: "Carros", icon: <Car size={28} /> },
  BOAT: { label: "Barcos", icon: <Ship size={28} /> },
  AIRCRAFT: { label: "Aeronaves", icon: <Plane size={28} /> },
};

export default function ConsultoriaPage() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [groupedSpecialists, setGroupedSpecialists] = useState<GroupedSpecialists | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSpecialist, setSelectedSpecialist] = useState<Specialist | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalState, setModalState] = useState<"initial" | "loading" | "success" | "error">("initial");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [calendlyOpened, setCalendlyOpened] = useState(false);

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
    ? (["CAR", "BOAT", "AIRCRAFT"] as SpecialityType[]).map(type => ({
        type,
        label: specialityConfig[type].label,
        icon: specialityConfig[type].icon,
        specialists: groupedSpecialists[type] || [],
      }))
    : [];

  const handleRequestMeeting = (specialist: Specialist) => {
    setSelectedSpecialist(specialist);
    setShowModal(true);
    setModalState("initial");
    setErrorMessage("");
    setCalendlyOpened(false);
  };

  const handleOpenCalendly = () => {
    if (selectedSpecialist?.calendly_url) {
      window.open(selectedSpecialist.calendly_url, "_blank");
      setCalendlyOpened(true);
    }
  };

  const handleConfirmAppointment = async () => {
    if (!selectedSpecialist || !user) return;

    setModalState("loading");
    setErrorMessage("");

    try {
      await createConsultancyAppointment({
        client_id: user.id,
        specialist_id: selectedSpecialist.id,
        notes: `Consultoria solicitada pelo cliente`,
      });

      setModalState("success");
      
      // Redirecionar após 2 segundos
      setTimeout(() => {
        navigate("/cliente/processos");
      }, 2000);
    } catch (error: any) {
      setModalState("error");
      const message = error?.response?.data?.error?.message || 
                      error?.message || 
                      "Erro ao confirmar agendamento. Tente novamente.";
      setErrorMessage(message);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedSpecialist(null);
    setModalState("initial");
    setErrorMessage("");
    setCalendlyOpened(false);
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
          Nossos especialistas estão prontos para ajudá-lo a encontrar o veículo perfeito. 
          Escolha um especialista na categoria de seu interesse para agendar uma consultoria.
        </p>
      </div>

      {/* Specialists by Category */}
      <div className="space-y-12">
        {specialistGroups.map((group) => (
          <div key={group.type} className="space-y-6">
            {/* Category Header */}
            <div className="flex items-center gap-4 border-b-2 border-gray-200 pb-4">
              <div className="p-3 bg-primary/10 rounded-full text-primary">
                {group.icon}
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{group.label}</h2>
              <span className="text-sm text-gray-500">
                ({group.specialists.length} especialista{group.specialists.length !== 1 ? 's' : ''})
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

      {/* Modal - Agendamento de Consultoria */}
      {showModal && selectedSpecialist && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full space-y-6">
            {modalState === "success" ? (
              // Estado de sucesso
              <>
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="p-4 bg-green-100 rounded-full">
                    <CheckCircle2 size={48} className="text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Agendamento Confirmado!</h3>
                  <p className="text-gray-600">
                    Sua consultoria com <strong>{selectedSpecialist.name} {selectedSpecialist.surname}</strong> foi registrada.
                    Você será redirecionado para seus processos em breve.
                  </p>
                </div>
              </>
            ) : modalState === "error" ? (
              // Estado de erro
              <>
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="p-4 bg-red-100 rounded-full">
                    <AlertCircle size={48} className="text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Erro no Agendamento</h3>
                  <p className="text-gray-600">{errorMessage}</p>
                </div>
                <div className="flex justify-end gap-3">
                  <Button onClick={handleCloseModal} variant="outline">
                    Fechar
                  </Button>
                  <Button onClick={handleConfirmAppointment} variant="solid">
                    Tentar Novamente
                  </Button>
                </div>
              </>
            ) : (
              // Estado inicial e loading
              <>
                <h3 className="text-xl font-bold text-gray-900">Agendar Consultoria</h3>
                <div className="space-y-4">
                  <p className="text-gray-600">
                    Você está prestes a agendar uma consultoria com{" "}
                    <strong>{selectedSpecialist.name} {selectedSpecialist.surname}</strong>.
                  </p>
                  
                  {selectedSpecialist.calendly_url ? (
                    <div className="space-y-4">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-800 mb-3">
                          <strong>Passo 1:</strong> Clique no botão abaixo para abrir o calendário do especialista 
                          e escolher um horário disponível.
                        </p>
                        <Button
                          onClick={handleOpenCalendly}
                          variant="outline"
                          className="w-full flex items-center justify-center gap-2"
                          disabled={modalState === "loading"}
                        >
                          <Calendar size={18} />
                          Abrir Calendário
                          <ExternalLink size={14} />
                        </Button>
                        {calendlyOpened && (
                          <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                            <CheckCircle2 size={14} />
                            Calendário aberto em nova aba
                          </p>
                        )}
                      </div>
                      
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-sm text-gray-700 mb-3">
                          <strong>Passo 2:</strong> Após escolher o horário no calendário, 
                          clique no botão abaixo para confirmar seu interesse.
                        </p>
                        <Button
                          onClick={handleConfirmAppointment}
                          variant="solid"
                          className="w-full flex items-center justify-center gap-2"
                          disabled={modalState === "loading" || !calendlyOpened}
                        >
                          {modalState === "loading" ? (
                            <>
                              <Loader2 size={18} className="animate-spin" />
                              Confirmando...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={18} />
                              Confirmar Agendamento
                            </>
                          )}
                        </Button>
                        {!calendlyOpened && (
                          <p className="text-xs text-gray-500 mt-2">
                            Abra o calendário primeiro para habilitar a confirmação
                          </p>
                        )}
                      </div>
                      
                      <p className="text-xs text-gray-500 text-center">
                        Durante a consultoria, o especialista irá recomendar os melhores produtos para você.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-yellow-800">
                        Este especialista ainda não configurou seu calendário de agendamentos. 
                        Por favor, entre em contato diretamente por e-mail: <strong>{selectedSpecialist.email}</strong>
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleCloseModal} variant="outline" disabled={modalState === "loading"}>
                    Cancelar
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface SpecialistCardProps {
  specialist: Specialist;
  onRequestMeeting: (specialist: Specialist) => void;
}

function SpecialistCard({ specialist, onRequestMeeting }: SpecialistCardProps) {
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
        >
          <Calendar size={18} />
          Solicitar Reunião
        </Button>
      </div>
    </div>
  );
}

