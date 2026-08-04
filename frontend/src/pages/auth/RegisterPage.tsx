import LoginImageDesktop from "../../assets/loginCarDesktop.png";
import {
  useForm,
  type SubmitErrorHandler,
  type SubmitHandler,
} from "react-hook-form";
import { AuthContext } from "../../contexts/AuthContext";
import { useContext, useEffect, useState } from "react";
import type { RegisterValues } from "../../types/types";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Button from "../../components/ui/button";
import { applyCpfMask, applyRgMask, applyPhoneMask } from "../../utils/mask";

type RegistrationMode = 'referral' | 'public';

export default function RegisterPage() {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const redirectPathFromState = (location.state as { from?: string } | null)
    ?.from;
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>('public');
  const [consultantName, setConsultantName] = useState<string>("");
  const [consultantId, setConsultantId] = useState<string>("");
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [tokenError, setTokenError] = useState<string>("");

  const { register, handleSubmit, setValue, formState: { errors }, watch } = useForm<RegisterValues>({
    mode: "onChange",
    defaultValues: {
      name: "",
      surname: "",
      email: "",
      cpf: "",
      rg: "",
      phone: "",
      password: "",
      civil_state: undefined,
      consultant_id: undefined,
    },
  });

  const watchedCpf = watch("cpf");
  const watchedPassword = watch("password");

  const validateCPF = (cpf: string): boolean => {
    const cleaned = cpf.replace(/\D/g, "");
    if (cleaned.length !== 11) return false;
    
    if (/^(\d)\1{10}$/.test(cleaned)) return false;
    
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleaned.charAt(i)) * (10 - i);
    }
    let digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;
    if (digit !== parseInt(cleaned.charAt(9))) return false;
    
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleaned.charAt(i)) * (11 - i);
    }
    digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;
    if (digit !== parseInt(cleaned.charAt(10))) return false;
    
    return true;
  };

  useEffect(() => {
    const validateToken = async () => {
      const token = searchParams.get("ref");
      
      // Modo público: sem token de referência
      if (!token) {
        setRegistrationMode('public');
        setIsValidatingToken(false);
        return;
      }

      // Modo referência: valida token do consultor
      setRegistrationMode('referral');
      
      try {
        const payload = await auth.validateReferralToken(token);
        setConsultantId(payload.consultantId);
        setConsultantName(payload.consultantName || "um consultor");
        setValue("email", payload.email);
        setValue("consultant_id", payload.consultantId);
        setIsValidatingToken(false);
      } catch (error: any) {
        const errorMessage = error?.response?.data?.message || error?.message || "Link de convite inválido ou expirado. Entre em contato com seu consultor para receber um novo convite.";
        setTokenError(errorMessage);
        setIsValidatingToken(false);
      }
    };

    validateToken();
  }, [searchParams, auth, setValue]);

  const onSubmit: SubmitHandler<RegisterValues> = async (data: RegisterValues) => {
    try {
      const cpfClean = data.cpf.replace(/\D/g, "");
      const rgClean = data.rg.replace(/\D/g, "");
      const phoneClean = data.phone.replace(/\D/g, "");
      
      const registerData: any = {
        ...data,
        cpf: cpfClean,
        rg: rgClean,
        phone: phoneClean,
      };
      
      // Só inclui consultant_id se for modo referência
      if (registrationMode === 'referral' && consultantId) {
        registerData.consultant_id = consultantId;
      }
      
      await auth.register(registerData);
      
      alert("Cadastro realizado com sucesso! Faça login para continuar.");
      navigate("/login", {
        state: redirectPathFromState ? { from: redirectPathFromState } : undefined,
      });
    } catch (error: any) {
      alert(error?.response?.data?.message || "Erro ao realizar cadastro. Verifique os dados e tente novamente.");
    }
  };

  const onError: SubmitErrorHandler<RegisterValues> = () => {
    // Validation errors handled by react-hook-form
  };


  const validatePhone = (value: string) => {
    const d = value.replace(/\D/g, "").length;
    return d === 10 || d === 11;
  };

  if (isValidatingToken) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-border border-t-ink"></div>
          <p className="text-ink-soft font-medium">Validando convite...</p>
        </div>
      </div>
    );
  }

  if (tokenError) {
    const isUserAlreadyExists = tokenError.includes("Já existe uma conta cadastrada");
    
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-bg p-4">
        <div className="max-w-md w-full bg-surface rounded-2xl shadow-ds-modal p-8 border border-border-soft">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              isUserAlreadyExists ? 'bg-status-sched-wash' : 'bg-status-bad-wash'
            }`}>
              {isUserAlreadyExists ? (
                <svg className="w-8 h-8 text-status-sched" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              ) : (
                <svg className="w-8 h-8 text-status-bad" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
            </div>
            <h2 className="text-2xl font-bold text-ink">
              {isUserAlreadyExists ? 'Conta Já Cadastrada' : 'Convite Inválido'}
            </h2>
            <p className="text-muted text-sm">{tokenError}</p>
            <Button
              onClick={() =>
                navigate("/login", {
                  state: redirectPathFromState
                    ? { from: redirectPathFromState }
                    : undefined,
                })
              }
              className="mt-4"
            >
              {isUserAlreadyExists ? 'Fazer Login' : 'Ir para Login'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex">
      {/* Coluna Esquerda - Formulário */}
      <div className="w-full lg:w-1/2 h-full overflow-y-auto bg-bg">
        <div className="min-h-full flex items-center justify-center p-4 sm:p-6 lg:p-8">
          <div className="w-full max-w-md">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-ink-soft mb-4">
                <svg className="w-8 h-8 text-surface" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-ink mb-2">
                Criar Conta
              </h1>
              {registrationMode === 'referral' && consultantName ? (
                <p className="text-sm text-muted">
                  <span className="font-semibold text-ink">{consultantName}</span> convidou você
                </p>
              ) : (
                <p className="text-sm text-muted">
                  Preencha seus dados para criar sua conta
                </p>
              )}
            </div>

            {/* Formulário Compacto */}
            <form onSubmit={handleSubmit(onSubmit, onError)} className="space-y-3">
              {/* Nome e Sobrenome - Lado a lado */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="name" className="block text-xs font-medium text-ink-soft mb-1">
                    Nome
                  </label>
                  <input
                    id="name"
                    type="text"
                    placeholder="João"
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 transition-all ${
                      errors.name
                        ? 'border-status-bad focus:ring-status-bad'
                        : watch("name") && watch("name").length >= 2
                        ? 'border-status-ok focus:ring-status-ok'
                        : 'border-border focus:ring-focus-ring focus:border-transparent'
                    }`}
                    {...register("name", {
                      required: "Nome é obrigatório",
                      minLength: { value: 2, message: "Mínimo 2 caracteres" }
                    })}
                  />
                  {errors.name && <p className="text-xs text-status-bad mt-1">{errors.name.message}</p>}
                </div>
                <div>
                  <label htmlFor="surname" className="block text-xs font-medium text-ink-soft mb-1">
                    Sobrenome
                  </label>
                  <input
                    id="surname"
                    type="text"
                    placeholder="Silva"
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 transition-all ${
                      errors.surname
                        ? 'border-status-bad focus:ring-status-bad'
                        : watch("surname") && watch("surname").length >= 2
                        ? 'border-status-ok focus:ring-status-ok'
                        : 'border-border focus:ring-focus-ring focus:border-transparent'
                    }`}
                    {...register("surname", {
                      required: "Sobrenome é obrigatório",
                      minLength: { value: 2, message: "Mínimo 2 caracteres" }
                    })}
                  />
                  {errors.surname && <p className="text-xs text-status-bad mt-1">{errors.surname.message}</p>}
                </div>
              </div>

              {/* E-mail */}
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-ink-soft mb-1">
                  E-mail {registrationMode === 'referral' && <span className="text-muted font-normal">(vinculado ao convite)</span>}
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder={registrationMode === 'public' ? "seu@email.com" : undefined}
                  className={`w-full px-3 py-2 text-sm border rounded-lg ${
                    registrationMode === 'referral'
                      ? 'border-border bg-bg text-muted'
                      : 'border-border focus:ring-2 focus:ring-focus-ring focus:border-transparent'
                  }`}
                  disabled={registrationMode === 'referral'}
                  {...register("email", {
                    required: "E-mail é obrigatório",
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: "E-mail inválido"
                    }
                  })}
                />
                {errors.email && <p className="text-xs text-status-bad mt-1">{errors.email.message}</p>}
              </div>

              {/* CPF e RG - Lado a lado */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cpf" className="block text-xs font-medium text-ink-soft mb-1">
                    CPF
                  </label>
                  <input
                    id="cpf"
                    type="text"
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 transition-all ${
                      errors.cpf
                        ? 'border-status-bad focus:ring-status-bad'
                        : watchedCpf && validateCPF(watchedCpf)
                        ? 'border-status-ok focus:ring-status-ok'
                        : 'border-border focus:ring-focus-ring focus:border-transparent'
                    }`}
                    {...register("cpf", {
                      required: "CPF é obrigatório",
                      validate: (value) => validateCPF(value) || "CPF inválido",
                      onChange: (e) => {
                        e.target.value = applyCpfMask(e.target.value);
                      }
                    })}
                  />
                  {errors.cpf && <p className="text-xs text-status-bad mt-1">{errors.cpf.message}</p>}
                </div>
                <div>
                  <label htmlFor="rg" className="block text-xs font-medium text-ink-soft mb-1">
                    RG
                  </label>
                  <input
                    id="rg"
                    type="text"
                    placeholder="0000000 ou CPF completo"
                    maxLength={14}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 transition-all ${
                      errors.rg
                        ? 'border-status-bad focus:ring-status-bad'
                        : watch("rg") && (() => { const d = watch("rg").replace(/\D/g, "").length; return d >= 7 && d <= 11; })()
                        ? 'border-status-ok focus:ring-status-ok'
                        : 'border-border focus:ring-focus-ring focus:border-transparent'
                    }`}
                    {...register("rg", {
                      required: "RG é obrigatório",
                      validate: (value) => { const d = value.replace(/\D/g, "").length; return (d >= 7 && d <= 11) || "RG deve ter entre 7 e 11 dígitos"; },
                      onChange: (e) => {
                        e.target.value = applyRgMask(e.target.value);
                      }
                    })}
                  />
                  {errors.rg && <p className="text-xs text-status-bad mt-1">{errors.rg.message}</p>}
                </div>
              </div>

              {/* Telefone */}
              <div>
                <label htmlFor="phone" className="block text-xs font-medium text-ink-soft mb-1">
                  Telefone
                </label>
                <input
                  id="phone"
                  type="text"
                  placeholder="(11) 99999-9999"
                  maxLength={16}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 transition-all ${
                    errors.phone
                      ? 'border-status-bad focus:ring-status-bad'
                      : watch("phone") && validatePhone(watch("phone"))
                      ? 'border-status-ok focus:ring-status-ok'
                      : 'border-border focus:ring-focus-ring focus:border-transparent'
                  }`}
                  {...register("phone", {
                    required: "Telefone é obrigatório",
                    validate: (value) => validatePhone(value) || "Telefone deve ter 10 ou 11 dígitos",
                    onChange: (e) => {
                      e.target.value = applyPhoneMask(e.target.value);
                    }
                  })}
                />
                {errors.phone && <p className="text-xs text-status-bad mt-1">{errors.phone.message}</p>}
              </div>

              {/* Senha e Estado Civil - Lado a lado */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="password" className="block text-xs font-medium text-ink-soft mb-1">
                    Senha
                  </label>
                  <input
                    id="password"
                    type="password"
                    placeholder="Min. 6 caracteres"
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 transition-all ${
                      errors.password
                        ? 'border-status-bad focus:ring-status-bad'
                        : watchedPassword && watchedPassword.length >= 6
                        ? 'border-status-ok focus:ring-status-ok'
                        : 'border-border focus:ring-focus-ring focus:border-transparent'
                    }`}
                    {...register("password", {
                      required: "Senha é obrigatória",
                      minLength: { value: 6, message: "Mínimo 6 caracteres" }
                    })}
                  />
                  {errors.password && <p className="text-xs text-status-bad mt-1">{errors.password.message}</p>}
                  {watchedPassword && watchedPassword.length > 0 && watchedPassword.length < 6 && (
                    <p className="text-xs text-status-neg mt-1">Senha muito curta</p>
                  )}
                </div>
                <div>
                  <label htmlFor="civil_state" className="block text-xs font-medium text-ink-soft mb-1">
                    Estado Civil
                  </label>
                  <select
                    id="civil_state"
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-transparent transition-all"
                    {...register("civil_state")}
                  >
                    <option value="">Selecione</option>
                    <option value="SINGLE">Solteiro(a)</option>
                    <option value="MARRIED">Casado(a)</option>
                    <option value="DIVORCED">Divorciado(a)</option>
                    <option value="WIDOWED">Viúvo(a)</option>
                    <option value="SEPARATED">Separado(a)</option>
                    <option value="STABLE_UNION">União Estável</option>
                  </select>
                </div>
              </div>

              {/* Botões */}
              <div className="pt-4 space-y-3">
                <Button type="submit" className="w-full">
                  Criar Conta
                </Button>
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="w-full text-sm text-muted hover:text-ink transition-colors"
                >
                  Já tem uma conta? <span className="font-semibold">Faça login</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Coluna Direita - Imagem */}
      <div className="hidden lg:block lg:w-1/2 h-full relative">
        <img
          src={LoginImageDesktop}
          className="w-full h-full object-cover"
          alt="Luxury car"
        />        
      </div>
    </div>
  );
}
