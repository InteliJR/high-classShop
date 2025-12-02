import { useEffect, useState } from "react";
import { Car, Ship, Plane, Calendar, UserCircle2 } from "lucide-react";
import { getSpecialistsGroupedByCategory, type Specialist, type GroupedSpecialists } from "../../services/specialists.service";
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
  const [groupedSpecialists, setGroupedSpecialists] = useState<GroupedSpecialists | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSpecialist, setSelectedSpecialist] = useState<Specialist | null>(null);
  const [showModal, setShowModal] = useState(false);

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
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600">Carregando especialistas...</div>
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

      {/* Modal - Funcionalidade em desenvolvimento */}
      {showModal && selectedSpecialist && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full space-y-6">
            <h3 className="text-xl font-bold text-gray-900">Funcionalidade em Desenvolvimento</h3>
            <p className="text-gray-600">
              O agendamento de reuniões com <strong>{selectedSpecialist.name} {selectedSpecialist.surname}</strong> estará 
              disponível em breve. Estamos trabalhando para trazer essa funcionalidade para você!
            </p>
            <div className="flex justify-end">
              <Button onClick={() => setShowModal(false)} variant="solid">
                Entendi
              </Button>
            </div>
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

