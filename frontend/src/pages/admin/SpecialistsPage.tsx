import { useEffect, useState, useContext } from "react";
import {
  getSpecialists,
  deleteSpecialist,
  type Specialist,
} from "../../services/specialists.service";
import { getSpecialistDashboardStats } from "../../services/dashboard.service";
import Button from "../../components/ui/button";
import { Alert } from "../../components/ui/alert";
import { Dialog, DialogContent } from "../../components/ui/dialog";
import { PageHeader } from "../../components/patterns/PageHeader";
import NewSpecialistForm from "./NewSpecialistForm";
import { AppContext } from "../../contexts/AppContext";
import { Pencil, Trash2 } from "lucide-react";

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-3 border-border-soft border-t-primary rounded-full animate-spin" />
          <p className="text-muted">Carregando especialistas...</p>
        </div>
      </div>
    );
  }
  if (error) return <Alert variant="danger">{error}</Alert>;

  return (
    <div className="text-text-main w-full">
      {/* Cabeçalho */}
      <PageHeader
        title="Gestão de Especialistas"
        actions={
          <Button type="button" onClick={() => setIsNewSpecialistModalOpen(true)}>
            + Novo Especialista
          </Button>
        }
      />

      {/* Tabela */}
      <div className="p-6 rounded-lg shadow bg-brand-container bg-bg-container overflow-x-auto">
        <h2 className="text-h2 font-semibold text-ink">Especialistas</h2>
        <p className="text-base mb-8 mt-2">Lista completa de especialistas</p>

        {/* Cabeçalho da lista */}
        <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-5 px-4 py-2 text-base font-normal text-left text-text-secondary">
          <div>Nome</div>
          <div>Especialidade</div>
          <div>Processos Abertos</div>
          <div>Taxa de Conversão</div>
          <div className="text-right">Ações</div>
        </div>

        {/* Corpo da lista */}
        <div className="mt-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto p-2">
          {filteredSpecialists.length === 0 ? (
            <p className="text-center text-muted py-8">
              {searchTerm
                ? "Nenhum especialista encontrado com esse termo de busca."
                : "Nenhum especialista cadastrado."}
            </p>
          ) : (
            filteredSpecialists.map((specialist) => {
              return (
                <div
                  key={specialist.id}
                  className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 md:gap-5 items-start md:items-center bg-brand-card p-4 md:p-6 rounded-lg shadow-sm bg-surface"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-normal">
                      {specialist.name} {specialist.surname}
                    </span>
                  </div>
                  <div>
                    <span className="bg-border-soft text-ink-soft text-base px-2.5 py-0.5 rounded-full">
                      {specialist.speciality ?? "-"}
                    </span>
                  </div>
                  <div>{specialist.activeProcesses ?? 0}</div>
                  <div>{specialist.conversionRate ?? 0}%</div>
                  <div className="flex justify-end items-center gap-4 text-subtle">
                    <button
                      onClick={() => setSpecialistToEdit(specialist)}
                      className="p-1.5 rounded hover:bg-border-soft text-ink-soft"
                      title="Editar"
                    >
                      <Pencil size={18} />
                    </button>

                    <button
                      onClick={() => setSpecialistToDelete(specialist)}
                      className="p-1.5 rounded hover:bg-status-bad-wash text-status-bad"
                      title="Deletar"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal criação/edição */}
      <Dialog
        open={isNewSpecialistModalOpen || !!specialistToEdit}
        onOpenChange={(open) => {
          if (!open) {
            setIsNewSpecialistModalOpen(false);
            setSpecialistToEdit(null);
          }
        }}
      >
        <DialogContent
          open={isNewSpecialistModalOpen || !!specialistToEdit}
          title={specialistToEdit ? "Editar Especialista" : "Novo Especialista"}
          hideTitle
        >
          <NewSpecialistForm
            onSuccess={handleFormSuccess}
            specialistToEdit={specialistToEdit}
          />
        </DialogContent>
      </Dialog>

      {/* Modal exclusão */}
      <Dialog open={!!specialistToDelete} onOpenChange={(open) => !open && setSpecialistToDelete(null)}>
        <DialogContent open={!!specialistToDelete} title="Confirmar Exclusão" hideTitle>
          <div className="text-center">
            <h2 className="text-h2 font-semibold text-ink mb-4">Confirmar Exclusão</h2>
            <p className="text-text-secondary mb-8">
              Tem a certeza que deseja apagar o especialista{" "}
              <span className="font-bold">{specialistToDelete?.name}</span>? Esta
              ação não pode ser desfeita.
            </p>
            <div className="flex justify-center gap-4">
              <Button variant="light" onClick={() => setSpecialistToDelete(null)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleConfirmDelete}>Confirmar Exclusão</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
