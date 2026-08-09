import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, CheckCircle, ExternalLink, Loader2 } from "lucide-react";
import { PopupModal } from "react-calendly";
import { getCarById, type RawCar } from "../../services/cars.service";
import { getBoatById, type RawBoat } from "../../services/boats.service";
import {
  getAircraftById,
  type RawAircraft,
} from "../../services/aircrafts.service";
import { getUserById } from "../../services/users.service";
import {
  checkExistingAppointment,
  createPendingAppointment,
  type Appointment,
} from "../../services/appointments.service";
import { getProcessesByClient } from "../../services/processes.service";
import ProductDetails from "../../components/product/ProductDetails";
import Loading from "../../components/ui/Loading";
import Button from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Alert } from "../../components/ui/alert";
import { Dialog, DialogContent } from "../../components/ui/dialog";
import { PageHeader } from "../../components/patterns/PageHeader";
import StartProcessForClientModal from "../consultant/StartProcessForClientModal";
import { useAuth } from "../../store/authStateManager";
import { useCheckAppointment } from "../../hooks/useCheckAppointment";
import { useCalendlyScheduling } from "../../hooks/useCalendlyScheduling";
import type { Product } from "../../types/types";

interface Specialist {
  id: string;
  name: string;
  surname: string;
  email: string;
  calendly_url: string | null;
  speciality: string | null;
}

/**
 * ProductPage
 *
 * Página de detalhes do produto.
 * Rota: /catalog/:productType/:id
 *
 * Exibe:
 * - Informações completas do produto (reutiliza ProductDetails)
 * - Seção para agendar reunião com especialista (se houver)
 *   - Com calendly_url: link para Calendly + confirmação
 *   - Sem calendly_url: botão para enviar e-mail + confirmação
 *   - Sem especialista: seção oculta
 *
 * Lógica de duplas:
 * - Verifica se existe agendamento SCHEDULED entre cliente + especialista + produto
 * - Se existe: mostra mensagem "Você já possui um agendamento marcado"
 * - Se não existe: mostra botões normalmente (Calendly ou Email)
 */
export default function ProductPage() {
  const { productType, id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [specialist, setSpecialist] = useState<Specialist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingPending, setIsCreatingPending] = useState(false);
  const [lockedAppointment, setLockedAppointment] =
    useState<Appointment | null>(null);
  const [isStartProcessModalOpen, setIsStartProcessModalOpen] = useState(false);
  // Aviso de resultado da tentativa de criação do agendamento PENDING, antes
  // de o popup do Calendly sequer abrir (conflito 409 / falha de rede). A
  // partir do momento que o popup abre, quem governa o aviso é o hook
  // (calendlySyncState / calendlySyncMessage).
  const [creationNotice, setCreationNotice] = useState<{
    variant: "success" | "danger";
    message: string;
  } | null>(null);

  const {
    isModalOpen: isCalendlyModalOpen,
    modalUrl: calendlyModalUrl,
    syncState: calendlySyncState,
    syncMessage: calendlySyncMessage,
    openPopup,
    closePopup,
  } = useCalendlyScheduling({
    successRedirectMessage:
      "Solicitação de agendamento registrada com sucesso! Verifique seus processos.",
    onSynced: (syncStatus) => {
      setLockedAppointment((prev) =>
        prev
          ? {
              ...prev,
              status:
                syncStatus.status === "PENDING" ? prev.status : syncStatus.status,
              appointment_datetime:
                syncStatus.appointment_datetime ?? prev.appointment_datetime,
              calendly_sync_status: syncStatus.calendly_sync_status,
            }
          : prev,
      );
    },
  });

  // Hook para verificar agendamentos existentes
  // APENAS dispara verificação após specialist ser carregado com sucesso
  const {
    existingAppointment,
    isLoading: isCheckingAppointment,
    error: checkAppointmentError,
  } = useCheckAppointment(
    user?.role === "CUSTOMER" && user?.id && specialist?.id ? user.id : undefined,
    specialist?.id,
    (productType?.toUpperCase() as "CAR" | "BOAT" | "AIRCRAFT") || undefined,
    product?.id,
  );

  const currentAppointment = lockedAppointment ?? existingAppointment;

  const redirectToProcesses = (message: string, delayMs: number = 900) => {
    setTimeout(() => {
      navigate("/customer/processes", {
        state: { message },
      });
    }, delayMs);
  };

  // Mapear productType para categoria do catálogo
  const categoryMap: Record<string, string> = {
    car: "cars",
    boat: "boats",
    aircraft: "aircrafts",
  };

  useEffect(() => {
    async function loadProduct() {
      if (!productType || !id) {
        setError("Produto não encontrado");
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        let rawProduct: RawCar | RawBoat | RawAircraft | null = null;

        switch (productType) {
          case "car":
            rawProduct = await getCarById(id);
            break;
          case "boat":
            rawProduct = await getBoatById(id);
            break;
          case "aircraft":
            rawProduct = await getAircraftById(id);
            break;
          default:
            throw new Error("Tipo de produto desconhecido");
        }

        if (!rawProduct) {
          throw new Error("Produto não encontrado");
        }

        // Obter descrição do produto (nome do campo varia por tipo)
        let descricao: string | undefined;
        if ("descricao" in rawProduct) {
          descricao = rawProduct.descricao as string | undefined;
        } else if ("descricao_completa" in rawProduct) {
          descricao = rawProduct.descricao_completa as string | undefined;
        }

        // Converter para Product
        const formattedProduct: Product = {
          id: rawProduct.id,
          marca: rawProduct.marca,
          modelo: rawProduct.modelo,
          valor: rawProduct.valor,
          descricao: descricao,
          ano: rawProduct.ano,
          estado: rawProduct.estado,
          specialist_id: rawProduct.specialist_id,
          images: rawProduct.images,
          // Campos específicos por tipo
          ...("cor" in rawProduct && { cor: rawProduct.cor }),
          ...("km" in rawProduct && { km: rawProduct.km }),
          ...("cambio" in rawProduct && { cambio: rawProduct.cambio }),
          ...("combustivel" in rawProduct && {
            combustivel: rawProduct.combustivel,
          }),
          ...("tipo_categoria" in rawProduct && {
            tipo_categoria: rawProduct.tipo_categoria,
          }),
          ...("fabricante" in rawProduct && {
            fabricante: rawProduct.fabricante,
          }),
          ...("tamanho" in rawProduct && { tamanho: rawProduct.tamanho }),
          ...("motor" in rawProduct && { motor: rawProduct.motor }),
          ...("tipo_embarcacao" in rawProduct && {
            tipo_embarcacao: rawProduct.tipo_embarcacao,
          }),
          ...("categoria" in rawProduct && { categoria: rawProduct.categoria }),
          ...("assentos" in rawProduct && { assentos: rawProduct.assentos }),
          ...("tipo_aeronave" in rawProduct && {
            tipo_aeronave: rawProduct.tipo_aeronave,
          }),
        };
        console.log(formattedProduct);

        setProduct(formattedProduct);

        // Buscar dados do especialista se houver
        if (rawProduct.specialist_id) {
          try {
            const specialistData = await getUserById(rawProduct.specialist_id);
            setSpecialist({
              id: specialistData.id,
              name: specialistData.name,
              surname: specialistData.surname,
              email: specialistData.email,
              calendly_url: specialistData.calendly_url,
              speciality: specialistData.speciality,
            });
          } catch (err) {
            console.warn(
              "Não foi possível carregar dados do especialista:",
              err,
            );
          }
        }
      } catch (err) {
        console.error("Erro ao carregar produto:", err);
        setError("Erro ao carregar produto");
      } finally {
        setLoading(false);
      }
    }

    loadProduct();
  }, [productType, id]);

  /**
   * Cria agendamento PENDING e abre Calendly em modal
   */
  const handleCalendlyClick = async () => {
    if (!specialist?.calendly_url || !user || !product) return;

    // Garantir que a URL tenha protocolo https://
    let formattedUrl = specialist.calendly_url.trim();
    if (
      !formattedUrl.startsWith("http://") &&
      !formattedUrl.startsWith("https://")
    ) {
      formattedUrl = `https://${formattedUrl}`;
    }

    setIsCreatingPending(true);
    setCreationNotice(null);
    try {
      const clientProcesses = await getProcessesByClient(user.id, 1, 100);
      const activeProcess = clientProcesses.find(
        (p) =>
          String(p.product_id) === String(product.id) &&
          p.product_type === productType?.toUpperCase() &&
          p.status !== "COMPLETED" &&
          p.status !== "REJECTED",
      );
      if (activeProcess) {
        const confirmed = window.confirm(
          "Você já possui um processo de negociação ativo para este produto.\n\nDeseja abrir um novo processo independente? Isso não cancelará o processo existente.",
        );
        if (!confirmed) {
          setIsCreatingPending(false);
          return;
        }
      }

      const pendingAppointment = await createPendingAppointment({
        client_id: user.id,
        specialist_id: specialist.id,
        product_type:
          (productType?.toUpperCase() as "CAR" | "BOAT" | "AIRCRAFT") || "CAR",
        product_id: product.id,
        notes: "Cliente abriu agendamento via popup da plataforma",
      });

      setLockedAppointment(pendingAppointment);
      openPopup(pendingAppointment.id, formattedUrl);
    } catch (err: any) {
      if (err.response?.status === 409) {
        try {
          if (user?.id && specialist?.id && product?.id && productType) {
            const existing = await checkExistingAppointment(
              user.id,
              specialist.id,
              productType.toUpperCase() as "CAR" | "BOAT" | "AIRCRAFT",
              product.id,
            );
            if (existing) {
              setLockedAppointment(existing);
            }
          }
        } catch (checkError) {
          console.error("Erro ao recuperar agendamento existente:", checkError);
        }
        setCreationNotice({
          variant: "success",
          message: "Você já possui uma solicitação de agendamento para este produto.",
        });
        redirectToProcesses(
          "Você já possui uma solicitação de agendamento para este produto.",
        );
      } else {
        console.error("Erro ao criar agendamento pendente:", err);
        setCreationNotice({
          variant: "danger",
          message: "Erro ao criar solicitação de agendamento.",
        });
      }
    } finally {
      setIsCreatingPending(false);
    }
  };

  const handleEmailClick = async () => {
    if (!specialist?.email || !user || !product) return;

    setIsCreatingPending(true);
    try {
      // Criar agendamento PENDING
      await createPendingAppointment({
        client_id: user.id,
        specialist_id: specialist.id,
        product_type:
          (productType?.toUpperCase() as "CAR" | "BOAT" | "AIRCRAFT") || "CAR",
        product_id: product.id,
        notes: "Cliente entrou em contato por email",
      });

      // Abrir email
      const subject = encodeURIComponent(
        `Interesse em ${product?.marca} ${product?.modelo}`,
      );
      const body = encodeURIComponent(
        `Olá ${specialist.name},\n\nTenho interesse no ${product?.marca} ${product?.modelo} e gostaria de agendar uma reunião.\n\nAtenciosamente.`,
      );
      window.location.href = `mailto:${specialist.email}?subject=${subject}&body=${body}`;

      // Redirecionar para página de processos do cliente
      setTimeout(() => {
        navigate("/customer/processes", {
          state: {
            message:
              "Solicitação de agendamento criada! O especialista irá confirmar em breve.",
          },
        });
      }, 500);
    } catch (err: any) {
      // Se já existe agendamento, apenas abrir o email
      if (err.response?.status === 409) {
        try {
          if (user?.id && specialist?.id && product?.id && productType) {
            const existing = await checkExistingAppointment(
              user.id,
              specialist.id,
              productType.toUpperCase() as "CAR" | "BOAT" | "AIRCRAFT",
              product.id,
            );
            if (existing) {
              setLockedAppointment(existing);
            }
          }
        } catch (checkError) {
          console.error("Erro ao recuperar agendamento existente:", checkError);
        }

        const subject = encodeURIComponent(
          `Interesse em ${product?.marca} ${product?.modelo}`,
        );
        const body = encodeURIComponent(
          `Olá ${specialist.name},\n\nTenho interesse no ${product?.marca} ${product?.modelo} e gostaria de agendar uma reunião.\n\nAtenciosamente.`,
        );
        window.location.href = `mailto:${specialist.email}?subject=${subject}&body=${body}`;
        redirectToProcesses(
          "Você já possui uma solicitação para este produto. Acompanhe em Meus Processos.",
          700,
        );
      } else {
        console.error("Erro ao criar agendamento pendente:", err);
        alert("Erro ao criar agendamento. Tente novamente.");
      }
    } finally {
      setIsCreatingPending(false);
    }
  };

  const handleBackToCatalog = () => {
    const category = categoryMap[productType || ""] || "cars";
    navigate(`/catalog/${category}`);
  };

  if (loading) {
    return <Loading size="lg" text="Carregando produto..." fullScreen />;
  }

  if (error || !product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <p className="text-xl text-muted mb-4">
          {error || "Produto não encontrado"}
        </p>
        <Button onClick={handleBackToCatalog}>
          <ArrowLeft size={18} />
          Voltar ao catálogo
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <PageHeader showBack title={`${product.marca} ${product.modelo}`} />

      {/* Detalhes do produto */}
      <Card className="p-4 md:p-6 mb-6">
        <ProductDetails product={product} />
      </Card>

      {/* Seção de agendamento - só aparece se houver especialista */}
      {specialist && (
        <Card className="p-4 md:p-6">
          <h2 className="text-xl font-semibold text-ink mb-4">
            Agendar Reunião
          </h2>

          {/* Informações do especialista */}
          <div className="bg-border-soft rounded-lg p-4 mb-6">
            <p className="text-sm text-muted mb-1">
              Especialista responsável
            </p>
            <p className="font-semibold text-ink">
              {specialist.name} {specialist.surname}
            </p>
            {specialist.speciality && (
              <p className="text-sm text-muted capitalize">
                Especialista em {specialist.speciality.toLowerCase()}s
              </p>
            )}
          </div>

          {/* Verifica se existe agendamento e mostra mensagem se houver */}
          {!user ? (
            /* Usuário não logado - mostrar botão para cadastro */
            <div className="space-y-4">
              <Alert variant="warning">
                <p className="text-sm">
                  <strong>Atenção:</strong> Para agendar uma reunião com o
                  especialista, você precisa criar uma conta ou fazer login.
                </p>
              </Alert>

              <Button
                onClick={() =>
                  navigate("/register", {
                    state: {
                      from: `/catalog/${productType}/${id}`,
                      message: "Crie sua conta para agendar uma reunião",
                    },
                  })
                }
                className="w-full"
              >
                Criar Conta para Agendar
              </Button>

              <p className="text-sm text-center text-muted">
                Já tem uma conta?{" "}
                <button
                  onClick={() =>
                    navigate("/login", {
                      state: { from: `/catalog/${productType}/${id}` },
                    })
                  }
                  className="text-blue-600 hover:underline font-medium"
                >
                  Fazer login
                </button>
              </p>
            </div>
          ) : user.role === "CONSULTANT" ? (
            /* Consultor - não agenda em nome próprio; inicia processo para um cliente */
            <div className="space-y-4">
              <Alert variant="info">
                <p className="text-sm">
                  <strong>Modo Consultor:</strong> Você não pode agendar uma reunião em seu próprio nome. Selecione qual cliente terá o processo criado para este produto.
                </p>
              </Alert>

              <Button
                onClick={() => setIsStartProcessModalOpen(true)}
                className="w-full"
              >
                Iniciar processo para cliente
              </Button>
            </div>
          ) : user.role !== "CUSTOMER" ? (
            /* SPECIALIST / ADMIN — apenas clientes podem agendar */
            <div className="bg-border-soft border border-border rounded-lg p-4">
              <p className="text-sm text-ink-soft">
                Apenas clientes podem agendar reuniões a partir do catálogo.
              </p>
            </div>
          ) : isCheckingAppointment ? (
            <Alert variant="info">
              <p className="text-sm">Verificando agendamentos...</p>
            </Alert>
          ) : checkAppointmentError ? (
            <Alert variant="warning">
              <p className="text-sm">
                Não foi possível validar seus agendamentos agora. Para evitar
                duplicidade, atualize a página e tente novamente em instantes.
              </p>
            </Alert>
          ) : currentAppointment ? (
            <Alert variant="success">
              <CheckCircle size={20} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  {currentAppointment.status === "PENDING"
                    ? "Aguardando confirmação do especialista"
                    : "Agendamento já realizado"}
                </p>
                <p className="text-sm mt-1">
                  {currentAppointment.status === "PENDING"
                    ? "Você já demonstrou interesse neste produto. O especialista irá confirmar seu agendamento em breve."
                    : "Você já possui um agendamento marcado com este especialista para este produto."}
                  {currentAppointment.appointment_datetime && (
                    <>
                      <br />
                      Data:{" "}
                      {new Date(
                        currentAppointment.appointment_datetime,
                      ).toLocaleDateString("pt-BR", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </>
                  )}
                </p>
              </div>
            </Alert>
          ) : specialist.calendly_url?.trim() ? (
            /* Com Calendly URL - Botão para acessar e criar PENDING */
            <div className="space-y-4">
              <Alert variant="info">
                <p className="text-sm">
                  <strong>Dica:</strong> Clique no botão abaixo para agendar
                  uma reunião no popup. Assim que concluir, a plataforma tenta
                  sincronizar automaticamente seu agendamento.
                </p>
              </Alert>

              {creationNotice ? (
                <Alert variant={creationNotice.variant}>
                  {creationNotice.message}
                </Alert>
              ) : (
                calendlySyncState !== "idle" &&
                calendlySyncMessage && (
                  <Alert
                    variant={
                      calendlySyncState === "error"
                        ? "danger"
                        : calendlySyncState === "done"
                          ? "success"
                          : "warning"
                    }
                  >
                    {calendlySyncMessage}
                  </Alert>
                )
              )}

              <Button
                onClick={handleCalendlyClick}
                disabled={isCreatingPending}
                className="w-full flex items-center justify-center gap-3"
              >
                {isCreatingPending ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5 text-white" />
                    Criando solicitação...
                  </>
                ) : (
                  <>
                    <ExternalLink size={20} />
                    Agendar reunião com o especialista
                  </>
                )}
              </Button>
            </div>
          ) : (
            /* Sem Calendly URL - fallback email */
            <div className="space-y-4">
              <p className="text-muted">
                Este especialista não possui agenda online. Entre em contato por
                e-mail para agendar uma reunião.
              </p>
              <Button
                onClick={handleEmailClick}
                disabled={isCreatingPending}
                className="w-full flex items-center justify-center gap-3"
              >
                {isCreatingPending ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5 text-white" />
                    Criando solicitação...
                  </>
                ) : (
                  <>
                    <Mail size={20} />
                    Enviar E-mail para o Especialista
                  </>
                )}
              </Button>
            </div>
          )}
        </Card>
      )}

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

      {/* Modal do Consultor: iniciar processo para cliente */}
      {specialist && product && productType && id && (
        <Dialog
          open={isStartProcessModalOpen}
          onOpenChange={setIsStartProcessModalOpen}
        >
          <DialogContent
            open={isStartProcessModalOpen}
            title="Iniciar processo para cliente"
            hideTitle
          >
            <StartProcessForClientModal
              productType={
                (productType.toUpperCase() === "CARS"
                  ? "CAR"
                  : productType.toUpperCase() === "BOATS"
                    ? "BOAT"
                    : productType.toUpperCase() === "AIRCRAFTS"
                      ? "AIRCRAFT"
                      : (productType.toUpperCase() as "CAR" | "BOAT" | "AIRCRAFT"))
              }
              productId={id}
              specialistId={specialist.id}
              productLabel={`${product.marca} ${product.modelo}`.trim()}
              onClose={() => setIsStartProcessModalOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
