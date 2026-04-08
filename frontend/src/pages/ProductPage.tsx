import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, CheckCircle, ExternalLink } from "lucide-react";
import { PopupModal, useCalendlyEventListener } from "react-calendly";
import { getCarById, type RawCar } from "../services/cars.service";
import { getBoatById, type RawBoat } from "../services/boats.service";
import {
  getAircraftById,
  type RawAircraft,
} from "../services/aircrafts.service";
import { getUserById } from "../services/users.service";
import {
  checkExistingAppointment,
  createPendingAppointment,
  getCalendlySyncStatus,
  registerCalendlyScheduledEvent,
  type Appointment,
} from "../services/appointments.service";
import ProductDetails from "../components/product/ProductDetails";
import Loading from "../components/ui/Loading";
import { useAuth } from "../store/authStateManager";
import { useCheckAppointment } from "../hooks/useCheckAppointment";
import type { Product } from "../types/types";

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
  const [isCalendlyModalOpen, setIsCalendlyModalOpen] = useState(false);
  const [calendlyModalUrl, setCalendlyModalUrl] = useState<string | null>(null);
  const [pendingAppointmentId, setPendingAppointmentId] = useState<
    string | null
  >(null);
  const [lockedAppointment, setLockedAppointment] =
    useState<Appointment | null>(null);
  const [calendlySyncState, setCalendlySyncState] = useState<
    "idle" | "waiting_event" | "syncing" | "done" | "error"
  >("idle");
  const [calendlySyncMessage, setCalendlySyncMessage] = useState<string>("");

  // Hook para verificar agendamentos existentes
  // APENAS dispara verificação após specialist ser carregado com sucesso
  const {
    existingAppointment,
    isLoading: isCheckingAppointment,
    error: checkAppointmentError,
  } = useCheckAppointment(
    user?.id && specialist?.id ? user.id : undefined, // Só passa se ambos existem
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
            rawProduct = await getCarById(Number(id));
            break;
          case "boat":
            rawProduct = await getBoatById(Number(id));
            break;
          case "aircraft":
            rawProduct = await getAircraftById(Number(id));
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

  useCalendlyEventListener({
    onEventScheduled: async (event) => {
      if (!pendingAppointmentId) {
        return;
      }

      const payload = (event as any)?.data?.payload;
      const eventUri = payload?.event?.uri;
      const inviteeUri = payload?.invitee?.uri;

      if (!eventUri || !inviteeUri) {
        setCalendlySyncState("error");
        setCalendlySyncMessage(
          "Não foi possível capturar os dados do agendamento. Verifique seus processos para confirmar.",
        );
        return;
      }

      try {
        setCalendlySyncState("syncing");
        setCalendlySyncMessage("Sincronizando seu agendamento...");

        await registerCalendlyScheduledEvent(pendingAppointmentId, {
          event_uri: eventUri,
          invitee_uri: inviteeUri,
          client_event: "calendly.event_scheduled",
          client_observed_at: new Date().toISOString(),
        });

        setIsCalendlyModalOpen(false);

        try {
          const syncStatus = await getCalendlySyncStatus(pendingAppointmentId);
          setLockedAppointment((prev) =>
            prev
              ? {
                  ...prev,
                  status:
                    syncStatus.status === "PENDING"
                      ? prev.status
                      : syncStatus.status,
                  appointment_datetime:
                    syncStatus.appointment_datetime ??
                    prev.appointment_datetime,
                  calendly_sync_status: syncStatus.calendly_sync_status,
                }
              : prev,
          );
        } catch (statusErr) {
          console.warn(
            "Não foi possível consultar status pós-sync:",
            statusErr,
          );
        }

        setCalendlySyncState("done");
        setCalendlySyncMessage(
          "Solicitação registrada com sucesso! Redirecionando para Meus Processos...",
        );
        redirectToProcesses(
          "Solicitação de agendamento registrada com sucesso! Verifique seus processos.",
          700,
        );
      } catch (err) {
        console.error("Erro ao sincronizar evento do Calendly:", err);
        setCalendlySyncState("error");
        setCalendlySyncMessage(
          "Agendamento criado, mas houve falha na sincronização automática. Redirecionando para Meus Processos...",
        );
        setIsCalendlyModalOpen(false);
        redirectToProcesses(
          "Solicitação criada! Se o horário não aparecer imediatamente, atualize a página de processos em instantes.",
          1000,
        );
      }
    },
  });

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
    setCalendlySyncState("idle");
    setCalendlySyncMessage("");
    try {
      const pendingAppointment = await createPendingAppointment({
        client_id: user.id,
        specialist_id: specialist.id,
        product_type:
          (productType?.toUpperCase() as "CAR" | "BOAT" | "AIRCRAFT") || "CAR",
        product_id: product.id,
        notes: "Cliente abriu agendamento via popup da plataforma",
      });

      setPendingAppointmentId(pendingAppointment.id);
      setLockedAppointment(pendingAppointment);
      setCalendlySyncState("waiting_event");
      setCalendlySyncMessage(
        "Conclua seu agendamento no Calendly para sincronizar automaticamente com a plataforma.",
      );

      setCalendlyModalUrl(formattedUrl);
      setIsCalendlyModalOpen(true);
    } catch (err: any) {
      if (err.response?.status === 409) {
        try {
          if (user?.id && specialist?.id && product?.id && productType) {
            const existing = await checkExistingAppointment(
              user.id,
              specialist.id,
              productType.toUpperCase() as "CAR" | "BOAT" | "AIRCRAFT",
              Number(product.id),
            );
            if (existing) {
              setLockedAppointment(existing);
            }
          }
        } catch (checkError) {
          console.error("Erro ao recuperar agendamento existente:", checkError);
        }
        setCalendlySyncState("done");
        setCalendlySyncMessage(
          "Você já possui uma solicitação de agendamento para este produto.",
        );
        redirectToProcesses(
          "Você já possui uma solicitação de agendamento para este produto.",
        );
      } else {
        console.error("Erro ao criar agendamento pendente:", err);
        setCalendlySyncState("error");
        setCalendlySyncMessage("Erro ao criar solicitação de agendamento.");
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
              Number(product.id),
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
        <p className="text-xl text-gray-600 mb-4">
          {error || "Produto não encontrado"}
        </p>
        <button
          onClick={handleBackToCatalog}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg"
        >
          <ArrowLeft size={18} />
          Voltar ao catálogo
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header com botão voltar */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={handleBackToCatalog}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Voltar ao catálogo"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          {product.marca} {product.modelo}
        </h1>
      </div>

      {/* Detalhes do produto */}
      <div className="bg-white rounded-lg shadow-lg p-4 md:p-6 mb-6">
        <ProductDetails product={product} />
      </div>

      {/* Seção de agendamento - só aparece se houver especialista */}
      {specialist && (
        <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Agendar Reunião
          </h2>

          {/* Informações do especialista */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600 mb-1">
              Especialista responsável
            </p>
            <p className="font-semibold text-gray-900">
              {specialist.name} {specialist.surname}
            </p>
            {specialist.speciality && (
              <p className="text-sm text-gray-500 capitalize">
                Especialista em {specialist.speciality.toLowerCase()}s
              </p>
            )}
          </div>

          {/* Verifica se existe agendamento e mostra mensagem se houver */}
          {!user ? (
            /* Usuário não logado - mostrar botão para cadastro */
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800">
                  <strong>🔐 Atenção:</strong> Para agendar uma reunião com o
                  especialista, você precisa criar uma conta ou fazer login.
                </p>
              </div>

              <button
                onClick={() =>
                  navigate("/register", {
                    state: {
                      from: `/catalog/${productType}/${id}`,
                      message: "Crie sua conta para agendar uma reunião",
                    },
                  })
                }
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Criar Conta para Agendar
              </button>

              <p className="text-sm text-center text-gray-500">
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
          ) : isCheckingAppointment ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                Verificando agendamentos...
              </p>
            </div>
          ) : checkAppointmentError ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800">
                Não foi possível validar seus agendamentos agora. Para evitar
                duplicidade, atualize a página e tente novamente em instantes.
              </p>
            </div>
          ) : currentAppointment ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle
                size={20}
                className="text-green-600 flex-shrink-0 mt-0.5"
              />
              <div>
                <p className="font-semibold text-green-900">
                  {currentAppointment.status === "PENDING"
                    ? "Aguardando confirmação do especialista"
                    : "Agendamento já realizado"}
                </p>
                <p className="text-sm text-green-800 mt-1">
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
            </div>
          ) : specialist.calendly_url?.trim() ? (
            /* Com Calendly URL - Botão para acessar e criar PENDING */
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>💡 Dica:</strong> Clique no botão abaixo para agendar
                  uma reunião no popup. Assim que concluir, a plataforma tenta
                  sincronizar automaticamente seu agendamento.
                </p>
              </div>

              {calendlySyncState !== "idle" && calendlySyncMessage && (
                <div
                  className={`rounded-lg border p-4 text-sm ${
                    calendlySyncState === "error"
                      ? "bg-red-50 border-red-200 text-red-800"
                      : calendlySyncState === "done"
                        ? "bg-green-50 border-green-200 text-green-800"
                        : "bg-amber-50 border-amber-200 text-amber-800"
                  }`}
                >
                  {calendlySyncMessage}
                </div>
              )}

              <button
                onClick={handleCalendlyClick}
                disabled={isCreatingPending}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingPending ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Criando solicitação...
                  </>
                ) : (
                  <>
                    <ExternalLink size={20} />
                    Agendar no Popup da Plataforma
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Sem Calendly URL - fallback email */
            <div className="space-y-4">
              <p className="text-gray-600">
                Este especialista não possui agenda online. Entre em contato por
                e-mail para agendar uma reunião.
              </p>
              <button
                onClick={handleEmailClick}
                disabled={isCreatingPending}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingPending ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Criando solicitação...
                  </>
                ) : (
                  <>
                    <Mail size={20} />
                    Enviar E-mail para o Especialista
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

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
    </div>
  );
}
