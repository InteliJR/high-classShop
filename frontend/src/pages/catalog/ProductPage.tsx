import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, ExternalLink, Loader2 } from "lucide-react";
import { PopupModal } from "react-calendly";
import { getCarById, type RawCar } from "../../services/cars.service";
import { getBoatById, type RawBoat } from "../../services/boats.service";
import {
  getAircraftById,
  type RawAircraft,
} from "../../services/aircrafts.service";
import {
  getPublicSpecialistById,
  type PublicSpecialistProfile,
} from "../../services/specialists.service";
import {
  createPendingAppointment,
  getActiveProcessSnapshot,
  type ActiveProcessSnapshot,
  type ProductPendingAppointmentInput,
  type PendingAppointmentCreated,
} from "../../services/appointments.service";
import { getProcessesByClient } from "../../services/processes.service";
import {
  browserTimeZone,
  parseAppointmentIso,
} from "../../lib/appointment-datetime";
import ProductDetails from "../../components/product/ProductDetails";
import Loading from "../../components/ui/Loading";
import Button from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Alert } from "../../components/ui/alert";
import { Dialog, DialogContent } from "../../components/ui/dialog";
import { PageHeader } from "../../components/patterns/PageHeader";
import StartProcessForClientModal from "../../components/processes/StartProcessForClientModal";
import AppointmentDateTimeModal from "../../components/appointments/AppointmentDateTimeModal";
import NoCalendlySchedulingActions from "../../components/appointments/NoCalendlySchedulingActions";
import EmailSchedulingSuccess from "../../components/appointments/EmailSchedulingSuccess";
import { useAuth } from "../../store/authStateManager";
import { useCheckAppointment } from "../../hooks/useCheckAppointment";
import { useCalendlyScheduling } from "../../hooks/useCalendlyScheduling";
import type { Product } from "../../types/types";

function appointmentSnapshot(
  appointment: PendingAppointmentCreated,
): ActiveProcessSnapshot {
  return {
    process_id: appointment.process_id,
    appointment_id: appointment.id,
    appointment_status: appointment.status,
    scheduling_method: appointment.scheduling_method ?? null,
    appointment_datetime: appointment.appointment_datetime ?? null,
  };
}

function validAppointmentDate(value: string | null): Date | null {
  try {
    return value ? parseAppointmentIso(value) : null;
  } catch {
    return null;
  }
}

function isPendingEmailRequest(
  request: ActiveProcessSnapshot | null,
): request is ActiveProcessSnapshot & {
  appointment_id: string;
  appointment_datetime: string;
} {
  return (
    request?.appointment_status === "PENDING" &&
    request.scheduling_method === "EMAIL" &&
    Boolean(request.appointment_id) &&
    Boolean(validAppointmentDate(request.appointment_datetime))
  );
}

function creationErrorMessage(error: unknown): string {
  const candidate = error as {
    friendlyMessage?: string;
    message?: string;
    response?: { data?: { error?: { message?: string } } };
  } | null;
  return (
    candidate?.friendlyMessage ||
    candidate?.response?.data?.error?.message ||
    candidate?.message ||
    "Não foi possível criar a solicitação. Tente novamente."
  );
}

/** Orchestrates an owned request, using only the backend's Calendly capability. */
export default function ProductPage() {
  const { productType, id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [specialist, setSpecialist] = useState<PublicSpecialistProfile | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingPending, setIsCreatingPending] = useState(false);
  const [lockedRequest, setLockedRequest] = useState<{
    scopeKey: string;
    snapshot: ActiveProcessSnapshot;
    autoOpen: boolean;
  } | null>(null);
  const [isStartProcessModalOpen, setIsStartProcessModalOpen] = useState(false);
  const [isDateTimeModalOpen, setIsDateTimeModalOpen] = useState(false);
  const [dateTimeError, setDateTimeError] = useState<string | null>(null);
  const [creationNotice, setCreationNotice] = useState<string | null>(null);
  const scopeKey = JSON.stringify([
    user?.id,
    user?.role,
    productType,
    id,
    product?.id,
    specialist?.id,
  ]);
  const currentScopeRef = useRef(scopeKey);
  currentScopeRef.current = scopeKey;
  const mountedRef = useRef(false);
  const creatingRef = useRef<object | null>(null);
  const requestProductType = productType?.toUpperCase() as
    | "CAR"
    | "BOAT"
    | "AIRCRAFT"
    | undefined;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    creatingRef.current = null;
    setIsCreatingPending(false);
    setLockedRequest(null);
    setIsDateTimeModalOpen(false);
    setDateTimeError(null);
    setCreationNotice(null);
  }, [scopeKey]);

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
      setLockedRequest((previous) =>
        previous?.scopeKey === currentScopeRef.current &&
        previous.snapshot.appointment_id === syncStatus.appointment_id
          ? {
              ...previous,
              snapshot: {
                ...previous.snapshot,
                appointment_status: syncStatus.status,
                appointment_datetime:
                  syncStatus.appointment_datetime ??
                  previous.snapshot.appointment_datetime,
              },
            }
          : previous,
      );
    },
  });

  const {
    existingAppointment,
    isLoading: isCheckingAppointment,
    error: checkAppointmentError,
  } = useCheckAppointment(specialist?.id, requestProductType, product?.id);
  const localRequest =
    lockedRequest?.scopeKey === scopeKey ? lockedRequest : null;
  const currentRequest =
    localRequest?.snapshot ??
    (existingAppointment?.exists ? existingAppointment : null);
  const emailRequest = isPendingEmailRequest(currentRequest)
    ? currentRequest
    : null;

  const categoryMap: Record<string, string> = {
    car: "cars",
    boat: "boats",
    aircraft: "aircrafts",
  };

  useEffect(() => {
    let active = true;
    async function loadProduct() {
      setLoading(true);
      setError(null);
      setProduct(null);
      setSpecialist(null);
      if (!productType || !id) {
        setError("Produto não encontrado");
        setLoading(false);
        return;
      }
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
        if (!active) return;
        if (!rawProduct) throw new Error("Produto não encontrado");
        let descricao: string | undefined;
        if ("descricao" in rawProduct)
          descricao = rawProduct.descricao as string | undefined;
        else if ("descricao_completa" in rawProduct)
          descricao = rawProduct.descricao_completa as string | undefined;
        const formattedProduct: Product = {
          id: rawProduct.id,
          marca: rawProduct.marca,
          modelo: rawProduct.modelo,
          valor: rawProduct.valor,
          currency: rawProduct.currency,
          descricao,
          ano: rawProduct.ano,
          estado: rawProduct.estado,
          specialist_id: rawProduct.specialist_id,
          images: rawProduct.images,
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
        setProduct(formattedProduct);
        if (rawProduct.specialist_id) {
          try {
            const profile = await getPublicSpecialistById(
              rawProduct.specialist_id,
            );
            if (active) setSpecialist(profile);
          } catch (error) {
            if (active)
              console.warn(
                "Não foi possível carregar dados do especialista:",
                error,
              );
          }
        }
      } catch (error) {
        if (active) {
          console.error("Erro ao carregar produto:", error);
          setError("Erro ao carregar produto");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadProduct();
    return () => {
      active = false;
    };
  }, [productType, id]);

  const submitRequest = async (
    input: ProductPendingAppointmentInput,
    calendlyUrl?: string,
  ) => {
    if (creatingRef.current) return;
    const request = {};
    const submittedScope = scopeKey;
    const isCurrent = () =>
      mountedRef.current &&
      currentScopeRef.current === submittedScope &&
      creatingRef.current === request;
    creatingRef.current = request;
    setIsCreatingPending(true);
    setDateTimeError(null);
    setCreationNotice(null);
    try {
      // Preserve the existing Calendly preflight before opening its popup.
      if (input.scheduling_method === "CALENDLY") {
        const processes = await getProcessesByClient(input.client_id, 1, 100);
        if (!isCurrent()) return;
        if (
          processes.some(
            (process) =>
              String(process.product_id) === input.product_id &&
              process.product_type === input.product_type &&
              process.status !== "COMPLETED" &&
              process.status !== "REJECTED",
          )
        ) {
          if (
            !window.confirm(
              "Você já possui um processo de negociação ativo para este produto.\n\nDeseja abrir um novo processo independente? Isso não cancelará o processo existente.",
            )
          )
            return;
        }
      }
      const appointment = await createPendingAppointment(input);
      if (!isCurrent()) return;
      setLockedRequest({
        scopeKey: submittedScope,
        snapshot: appointmentSnapshot(appointment),
        autoOpen: input.scheduling_method === "EMAIL",
      });
      setIsDateTimeModalOpen(false);
      if (input.scheduling_method === "CALENDLY" && calendlyUrl)
        openPopup(appointment.id, calendlyUrl);
    } catch (error) {
      if (!isCurrent()) return;
      const existing = getActiveProcessSnapshot(error);
      if (existing) {
        setLockedRequest({
          scopeKey: submittedScope,
          snapshot: existing,
          autoOpen: false,
        });
        setIsDateTimeModalOpen(false);
      } else if (input.scheduling_method === "EMAIL") {
        setDateTimeError(creationErrorMessage(error));
      } else {
        setCreationNotice(creationErrorMessage(error));
      }
    } finally {
      if (isCurrent()) {
        creatingRef.current = null;
        setIsCreatingPending(false);
      }
    }
  };

  const handleCalendlyClick = async () => {
    if (
      !specialist?.calendly_scheduling_available ||
      user?.role !== "CUSTOMER" ||
      !product ||
      !requestProductType ||
      currentRequest ||
      isCheckingAppointment ||
      checkAppointmentError ||
      existingAppointment?.exists !== false
    )
      return;
    if (!specialist.calendly_url) {
      setCreationNotice(
        "Não foi possível abrir a agenda do especialista. Atualize a página e tente novamente.",
      );
      return;
    }
    await submitRequest(
      {
        client_id: user.id,
        specialist_id: specialist.id,
        product_type: requestProductType,
        product_id: product.id,
        scheduling_method: "CALENDLY",
        notes: "Cliente abriu agendamento via popup da plataforma",
      },
      specialist.calendly_url.trim(),
    );
  };

  const handleEmailScheduling = async (appointmentDatetime: string) => {
    if (
      !specialist ||
      specialist.calendly_scheduling_available ||
      user?.role !== "CUSTOMER" ||
      !product ||
      !requestProductType ||
      currentRequest ||
      isCheckingAppointment ||
      checkAppointmentError ||
      existingAppointment?.exists !== false
    )
      return;
    await submitRequest({
      client_id: user.id,
      specialist_id: specialist.id,
      product_type: requestProductType,
      product_id: product.id,
      scheduling_method: "EMAIL",
      appointment_datetime: appointmentDatetime,
      notes: "Cliente propôs uma reunião por e-mail",
    });
  };

  const handleBackToCatalog = () =>
    navigate(`/catalog/${categoryMap[productType || ""] || "cars"}`);

  if (loading)
    return <Loading size="lg" text="Carregando produto..." fullScreen />;
  if (error || !product)
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

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <PageHeader showBack title={`${product.marca} ${product.modelo}`} />
      <Card className="p-4 md:p-6 mb-6">
        <ProductDetails product={product} />
      </Card>
      {specialist && (
        <Card className="p-4 md:p-6">
          <h2 className="text-xl font-semibold text-ink mb-4">
            Agendar Reunião
          </h2>
          <div className="bg-border-soft rounded-lg p-4 mb-6">
            <p className="text-sm text-muted mb-1">Especialista responsável</p>
            <p className="font-semibold text-ink">
              {specialist.name} {specialist.surname}
            </p>
            {specialist.speciality && (
              <p className="text-sm text-muted capitalize">
                Especialista em {specialist.speciality.toLowerCase()}s
              </p>
            )}
          </div>
          {user?.role === "CUSTOMER" &&
            (creationNotice ||
              (calendlySyncState !== "idle" && calendlySyncMessage)) && (
              <Alert
                variant={
                  creationNotice || calendlySyncState === "error"
                    ? "danger"
                    : calendlySyncState === "done"
                      ? "success"
                      : "warning"
                }
                className="mb-4"
              >
                {creationNotice || calendlySyncMessage}
              </Alert>
            )}
          {!user ? (
            <div className="space-y-4">
              <Alert variant="warning">
                <p className="text-sm">
                  <strong>Atenção:</strong> Para agendar uma reunião com o
                  especialista, você precisa criar uma conta ou fazer login.
                </p>
              </Alert>
              <Button
                className="w-full"
                onClick={() =>
                  navigate("/register", {
                    state: {
                      from: `/catalog/${productType}/${id}`,
                      message: "Crie sua conta para agendar uma reunião",
                    },
                  })
                }
              >
                Criar Conta para Agendar
              </Button>
              <p className="text-sm text-center text-muted">
                Já tem uma conta?{" "}
                <button
                  className="text-blue-600 hover:underline font-medium"
                  onClick={() =>
                    navigate("/login", {
                      state: { from: `/catalog/${productType}/${id}` },
                    })
                  }
                >
                  Fazer login
                </button>
              </p>
            </div>
          ) : user.role === "CONSULTANT" || user.role === "OFFICE" ? (
            <div className="space-y-4">
              <Alert variant="info">
                <p className="text-sm">
                  <strong>
                    {user.role === "OFFICE"
                      ? "Modo Escritório:"
                      : "Modo Consultor:"}
                  </strong>{" "}
                  Você não pode agendar uma reunião em seu próprio nome.
                  Selecione qual cliente{" "}
                  {user.role === "OFFICE" ? "do escritório " : ""}terá o
                  processo criado para este produto.
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
            <div className="bg-border-soft border border-border rounded-lg p-4">
              <p className="text-sm text-ink-soft">
                Apenas clientes podem agendar reuniões a partir do catálogo.
              </p>
            </div>
          ) : emailRequest ? (
            <EmailSchedulingSuccess
              key={emailRequest.appointment_id}
              appointmentId={emailRequest.appointment_id}
              recipient={specialist.email}
              specialistName={`${specialist.name} ${specialist.surname}`.trim()}
              clientName={`${user.name} ${user.surname}`.trim()}
              productLabel={`${product.marca} ${product.modelo}`.trim()}
              appointmentDatetime={emailRequest.appointment_datetime}
              timeZone={browserTimeZone()}
              autoOpen={localRequest?.autoOpen ?? false}
            />
          ) : currentRequest ? (
            <div className="space-y-4">
              <Alert variant="success">
                <CheckCircle size={20} className="flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">
                    {currentRequest.appointment_status === "PENDING"
                      ? "Aguardando confirmação do especialista"
                      : currentRequest.appointment_status === "SCHEDULED"
                        ? "Agendamento já realizado"
                        : "Você já possui um processo ativo para este produto"}
                  </p>
                  <p className="text-sm mt-1">
                    {currentRequest.appointment_status === "PENDING"
                      ? "Você já demonstrou interesse neste produto. Acompanhe sua solicitação em Meus Processos."
                      : currentRequest.appointment_status === "SCHEDULED"
                        ? "Você já possui um agendamento marcado com este especialista para este produto."
                        : "Acompanhe o processo existente em Meus Processos."}
                    {validAppointmentDate(
                      currentRequest.appointment_datetime,
                    ) && (
                      <>
                        <br />
                        Data:{" "}
                        {validAppointmentDate(
                          currentRequest.appointment_datetime,
                        )?.toLocaleString("pt-BR", {
                          dateStyle: "long",
                          timeStyle: "short",
                        })}
                      </>
                    )}
                  </p>
                </div>
              </Alert>
              <a
                href="/customer/processes"
                className="inline-flex w-full justify-center rounded-lg border border-border px-4 py-3 font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-focus-ring"
              >
                Acompanhar processo
              </a>
            </div>
          ) : checkAppointmentError ? (
            <Alert variant="warning">
              <p className="text-sm">
                Não foi possível validar seus agendamentos agora. Para evitar
                duplicidade, atualize a página e tente novamente em instantes.
              </p>
            </Alert>
          ) : isCheckingAppointment || !existingAppointment ? (
            <Alert variant="info">
              <p className="text-sm">Verificando agendamentos...</p>
            </Alert>
          ) : specialist.calendly_scheduling_available ? (
            <div className="space-y-4">
              <Alert variant="info">
                <p className="text-sm">
                  <strong>Dica:</strong> Clique no botão abaixo para agendar uma
                  reunião no popup. Assim que concluir, a plataforma tenta
                  sincronizar automaticamente seu agendamento.
                </p>
              </Alert>
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
            <NoCalendlySchedulingActions
              busy={isCreatingPending}
              onRequest={() => {
                setDateTimeError(null);
                setIsDateTimeModalOpen(true);
              }}
            />
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
      {/* Unmount the dialog before success focus; its animated exit must not retain a focus trap. */}
      {!currentRequest && user?.role === "CUSTOMER" && (
        <AppointmentDateTimeModal
          open={isDateTimeModalOpen}
          title="Solicitar reunião"
          description="Proponha uma data e hora. O horário ficará aguardando confirmação do especialista."
          submitLabel="Enviar solicitação"
          busy={isCreatingPending}
          serverError={dateTimeError}
          onClearServerError={() => setDateTimeError(null)}
          onOpenChange={setIsDateTimeModalOpen}
          onSubmit={handleEmailScheduling}
        />
      )}
      {specialist && productType && id && (
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
              productType={requestProductType ?? "CAR"}
              productId={id}
              specialistId={specialist.id}
              productLabel={`${product.marca} ${product.modelo}`.trim()}
              mode={user?.role === "OFFICE" ? "OFFICE" : "CONSULTANT"}
              onClose={() => setIsStartProcessModalOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
