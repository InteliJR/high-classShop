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
import { Table, TableHeader, TableBody, TableHead, TableCell } from "../../components/ui/table";
import { PageHeader } from "../../components/patterns/PageHeader";
import { EmptyState } from "../../components/patterns/EmptyState";
import NewSpecialistForm from "./NewSpecialistForm";
import { AppContext } from "../../contexts/AppContext";
import { Pencil, Trash2, UserCog } from "lucide-react";
import AdminUserManagementDialog, {
  type AdminUserManagementDialogState,
} from "../../components/admin/AdminUserManagementDialog";

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
  const [dialogState, setDialogState] =
    useState<AdminUserManagementDialogState | null>(null);
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
      <div className="p-6 rounded-lg shadow bg-brand-container bg-bg-container">
        <h2 className="text-h2 font-semibold text-ink">Especialistas</h2>
        <p className="text-base mb-8 mt-2">Lista completa de especialistas</p>

        {!isLoading && filteredSpecialists.length === 0 ? (
          <EmptyState
            icon={UserCog}
            title={searchTerm ? "Nenhum especialista encontrado" : "Nenhum especialista cadastrado"}
            description={
              searchTerm
                ? "Tente buscar por outro nome, e-mail ou especialidade."
                : 'Clique em "+ Novo Especialista" para começar.'
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <tr>
                <TableHead>Nome</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead>Processos Abertos</TableHead>
                <TableHead>Taxa de Conversão</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </tr>
            </TableHeader>
            <TableBody isLoading={isLoading} columns={5}>
              {filteredSpecialists.map((specialist) => (
                <tr key={specialist.id} className="border-b border-border-soft">
                  <TableCell>
                    {specialist.name} {specialist.surname}
                  </TableCell>
                  <TableCell>
                    <span className="bg-border-soft text-ink-soft text-xs px-2.5 py-0.5 rounded-full">
                      {specialist.speciality ?? "-"}
                    </span>
                  </TableCell>
                  <TableCell>{specialist.activeProcesses ?? 0}</TableCell>
                  <TableCell>{specialist.conversionRate ?? 0}%</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end items-center gap-4 text-subtle">
                      <button
                        onClick={() =>
                          setDialogState({
                            userId: specialist.id,
                            mode: "specialist",
                            speciality: specialist.speciality,
                            commissionRate: specialist.commission_rate,
                          })
                        }
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
                  </TableCell>
                </tr>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Modal criação/edição */}
      <Dialog
        open={isNewSpecialistModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsNewSpecialistModalOpen(false);
          }
        }}
      >
        <DialogContent
          open={isNewSpecialistModalOpen}
          title="Novo Especialista"
          hideTitle
        >
          <NewSpecialistForm
            onSuccess={handleFormSuccess}
          />
        </DialogContent>
      </Dialog>

      <AdminUserManagementDialog
        state={dialogState}
        onClose={() => setDialogState(null)}
        onSuccess={fetchData}
      />

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
