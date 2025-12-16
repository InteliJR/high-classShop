import { useEffect, useState, useContext } from "react";
import {
  getSpecialists,
  deleteSpecialist,
  type Specialist,
} from "../../services/specialists.service";
import { getSpecialistDashboardStats } from "../../services/dashboard.service";
import Button from "../../components/ui/button";
import EditIcon from "../../assets/icons/edit.svg";
import TrashIcon from "../../assets/icons/trash.svg";
import Modal from "../../components/ui/Modal";
import NewSpecialistForm from "./NewSpecialistForm";
import { AppContext } from "../../contexts/AppContext";

// Interface para armazenar os dados de cada especialista
interface SpecialistWithStats extends Specialist {
  activeProcesses?: number;
  conversionRate?: number;
}

export default function SpecialistsPage() {
  const [specialists, setSpecialists] = useState<SpecialistWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isNewSpecialistModalOpen, setIsNewSpecialistModalOpen] =
    useState(false);
  const [specialistToEdit, setSpecialistToEdit] = useState<Specialist | null>(
    null
  );
  const [specialistToDelete, setSpecialistToDelete] =
    useState<Specialist | null>(null);

  const { searchTerm } = useContext(AppContext);

  const filteredSpecialists = specialists.filter((specialist) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      specialist.name.toLowerCase().includes(searchLower) ||
      specialist.surname.toLowerCase().includes(searchLower) ||
      specialist.email.toLowerCase().includes(searchLower) ||
      specialist.speciality.toLowerCase().includes(searchLower)
    );
  });

  async function fetchData() {
    try {
      setIsLoading(true);
      const data = await getSpecialists();

      // Buscar estatísticas de cada especialista
      const specialistsWithStats = await Promise.all(
        data.map(async (specialist) => {
          try {
            const stats = await getSpecialistDashboardStats(specialist.id);
            return {
              ...specialist,
              activeProcesses: stats.activeProcesses,
              conversionRate: stats.conversionRate,
            };
          } catch (error) {
            console.error(`Erro ao buscar stats do especialista ${specialist.id}:`, error);
            return {
              ...specialist,
              activeProcesses: 0,
              conversionRate: 0,
            };
          }
        })
      );

      setSpecialists(specialistsWithStats);
      setError(null);
    } catch (err) {
      setError("Não foi possível carregar os especialistas.");
    } finally {
      setIsLoading(false);
    }
  }

  const handleFormSuccess = () => {
    setIsNewSpecialistModalOpen(false);
    setSpecialistToEdit(null);
    fetchData();
  };

  const handleConfirmDelete = async () => {
    if (!specialistToDelete) return;
    try {
      await deleteSpecialist(specialistToDelete.id);
      fetchData();
    } catch (err) {
      const errorMessage =
        (err as Error).message ||
        "Erro ao apagar o especialista. Tente novamente.";
      alert(errorMessage);
    } finally {
      setSpecialistToDelete(null);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (isLoading) return <p>Carregando...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="text-text-main w-full">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="h1-style">Gestão de Especialistas</h1>
        <Button type="button" onClick={() => setIsNewSpecialistModalOpen(true)}>
          + Novo Especialista
        </Button>
      </div>

      {/* Tabela */}
      <div className="p-6 rounded-lg shadow bg-brand-container bg-bg-container">
        <h2 className="h2-style">Especialistas</h2>
        <p className="text-base mb-8 mt-2">Lista completa de especialistas</p>

        {/* Cabeçalho da lista */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-5 px-4 py-2 text-base font-normal text-left text-text-secondary">
          <div>Nome</div>
          <div>Especialidade</div>
          <div>Processos Abertos</div>
          <div>Taxa de Conversão</div>
          <div className="text-right">Ações</div>
        </div>

        {/* Corpo da lista */}
        <div className="mt-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto p-2">
          {filteredSpecialists.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              {searchTerm
                ? "Nenhum especialista encontrado com esse termo de busca."
                : "Nenhum especialista cadastrado."}
            </p>
          ) : (
            filteredSpecialists.map((specialist) => {
              return (
                <div
                  key={specialist.id}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-5 items-center bg-brand-card p-6 rounded-lg shadow-sm bg-white"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-normal">
                      {specialist.name} {specialist.surname}
                    </span>
                  </div>
                  <div>
                    <span className="bg-blue-100 text-blue-800 text-base px-2.5 py-0.5 rounded-full">
                      {specialist.speciality ?? "-"}
                    </span>
                  </div>
                  <div>{specialist.activeProcesses ?? 0}</div>
                  <div>{specialist.conversionRate ?? 0}%</div>
                  <div className="flex justify-end items-center gap-4 text-gray-400">
                    <button onClick={() => setSpecialistToEdit(specialist)}>
                      <img
                        src={EditIcon}
                        alt="Editar"
                        className="h-6 w-6 cursor-pointer hover:text-gray-600"
                      />
                    </button>

                    <button onClick={() => setSpecialistToDelete(specialist)}>
                      <img
                        src={TrashIcon}
                        alt="Deletar"
                        className="h-5 w-5 cursor-pointer hover:text-gray-600"
                      />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal criação/edição */}
      <Modal
        isOpen={isNewSpecialistModalOpen || !!specialistToEdit}
        onClose={() => {
          setIsNewSpecialistModalOpen(false);
          setSpecialistToEdit(null);
        }}
      >
        <NewSpecialistForm
          onSuccess={handleFormSuccess}
          specialistToEdit={specialistToEdit}
        />
      </Modal>

      {/* Modal exclusão */}
      <Modal
        isOpen={!!specialistToDelete}
        onClose={() => setSpecialistToDelete(null)}
      >
        <div className="text-center">
          <h2 className="h2-style mb-4">Confirmar Exclusão</h2>
          <p className="text-text-secondary mb-8">
            Tem a certeza que deseja apagar o especialista{" "}
            <span className="font-bold">{specialistToDelete?.name}</span>? Esta
            ação não pode ser desfeita.
          </p>
          <div className="flex justify-center gap-4">
            <Button onClick={() => setSpecialistToDelete(null)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmDelete}>Confirmar Exclusão</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
