import LoginImageDesktop from "../../assets/loginCarDesktop.png";
import {
  useForm,
  type SubmitErrorHandler,
  type SubmitHandler,
} from "react-hook-form";
import { AuthContext } from "../../contexts/AuthContext";
import { useContext, useEffect, useState } from "react";
import type { RegisterValues } from "../../types/types";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function RegisterPage() {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
      
      if (!token) {
        setTokenError("Link de convite não encontrado. Você precisa de um convite de um consultor para se cadastrar.");
        setIsValidatingToken(false);
        return;
      }

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
      
      await auth.register({
        ...data,
        cpf: cpfClean,
        rg: rgClean,
        consultant_id: consultantId,
      });
      
      alert("Cadastro realizado com sucesso! Faça login para continuar.");
      navigate("/login");
    } catch (error: any) {
      alert(error?.response?.data?.message || "Erro ao realizar cadastro. Verifique os dados e tente novamente.");
    }
  };

  const onError: SubmitErrorHandler<RegisterValues> = () => {
    // Validation errors handled by react-hook-form
  };

  const formatCPF = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length <= 11) {
      return cleaned
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    return value;
  };

  const formatRG = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    return cleaned.slice(0, 10);
  };

  if (isValidatingToken) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-linear-to-br from-gray-50 to-white">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-gray-900"></div>
          <p className="text-gray-700 font-medium">Validando convite...</p>
        </div>
      </div>
    );
  }

  if (tokenError) {
    const isUserAlreadyExists = tokenError.includes("Já existe uma conta cadastrada");
    
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-linear-to-br from-gray-50 to-white p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              isUserAlreadyExists ? 'bg-blue-100' : 'bg-red-100'
            }`}>
              {isUserAlreadyExists ? (
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              ) : (
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              {isUserAlreadyExists ? 'Conta Já Cadastrada' : 'Convite Inválido'}
            </h2>
            <p className="text-gray-600 text-sm">{tokenError}</p>
            <button
              onClick={() => navigate("/login")}
              className="mt-4 px-6 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-black transition-all font-medium shadow-lg"
            >
              {isUserAlreadyExists ? 'Fazer Login' : 'Ir para Login'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex">
      {/* Coluna Esquerda - Formulário */}
      <div className="w-full lg:w-1/2 h-full overflow-y-auto bg-linear-to-br from-gray-50 to-white">
        <div className="min-h-full flex items-center justify-center p-4 sm:p-6 lg:p-8">
          <div className="w-full max-w-md">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-linear-to-br from-gray-700 to-gray-900 mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                Criar Conta
              </h1>
              {consultantName && (
                <p className="text-sm text-gray-600">
                  <span className="font-semibold text-gray-900">{consultantName}</span> convidou você
                </p>
              )}
            </div>

            {/* Formulário Compacto */}
            <form onSubmit={handleSubmit(onSubmit, onError)} className="space-y-3">
              {/* Nome e Sobrenome - Lado a lado */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="name" className="block text-xs font-medium text-gray-700 mb-1">
                    Nome
                  </label>
                  <input
                    id="name"
                    type="text"
                    placeholder="João"
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 transition-all ${
                      errors.name 
                        ? 'border-red-500 focus:ring-red-500' 
                        : watch("name") && watch("name").length >= 2
                        ? 'border-green-500 focus:ring-green-500'
                        : 'border-gray-300 focus:ring-gray-900 focus:border-transparent'
                    }`}
                    {...register("name", { 
                      required: "Nome é obrigatório", 
                      minLength: { value: 2, message: "Mínimo 2 caracteres" } 
                    })}
                  />
                  {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
                </div>
                <div>
                  <label htmlFor="surname" className="block text-xs font-medium text-gray-700 mb-1">
                    Sobrenome
                  </label>
                  <input
                    id="surname"
                    type="text"
                    placeholder="Silva"
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 transition-all ${
                      errors.surname 
                        ? 'border-red-500 focus:ring-red-500' 
                        : watch("surname") && watch("surname").length >= 2
                        ? 'border-green-500 focus:ring-green-500'
                        : 'border-gray-300 focus:ring-gray-900 focus:border-transparent'
                    }`}
                    {...register("surname", { 
                      required: "Sobrenome é obrigatório", 
                      minLength: { value: 2, message: "Mínimo 2 caracteres" } 
                    })}
                  />
                  {errors.surname && <p className="text-xs text-red-600 mt-1">{errors.surname.message}</p>}
                </div>
              </div>

              {/* E-mail */}
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-gray-700 mb-1">
                  E-mail <span className="text-gray-500 font-normal">(vinculado ao convite)</span>
                </label>
                <input
                  id="email"
                  type="email"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                  disabled
                  {...register("email", { required: true })}
                />
              </div>

              {/* CPF e RG - Lado a lado */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cpf" className="block text-xs font-medium text-gray-700 mb-1">
                    CPF
                  </label>
                  <input
                    id="cpf"
                    type="text"
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 transition-all ${
                      errors.cpf 
                        ? 'border-red-500 focus:ring-red-500' 
                        : watchedCpf && validateCPF(watchedCpf)
                        ? 'border-green-500 focus:ring-green-500'
                        : 'border-gray-300 focus:ring-gray-900 focus:border-transparent'
                    }`}
                    {...register("cpf", { 
                      required: "CPF é obrigatório",
                      validate: (value) => validateCPF(value) || "CPF inválido",
                      onChange: (e) => {
                        e.target.value = formatCPF(e.target.value);
                      }
                    })}
                  />
                  {errors.cpf && <p className="text-xs text-red-600 mt-1">{errors.cpf.message}</p>}
                </div>
                <div>
                  <label htmlFor="rg" className="block text-xs font-medium text-gray-700 mb-1">
                    RG
                  </label>
                  <input
                    id="rg"
                    type="text"
                    placeholder="0000000000"
                    maxLength={10}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 transition-all ${
                      errors.rg 
                        ? 'border-red-500 focus:ring-red-500' 
                        : watch("rg") && watch("rg").replace(/\D/g, "").length === 10
                        ? 'border-green-500 focus:ring-green-500'
                        : 'border-gray-300 focus:ring-gray-900 focus:border-transparent'
                    }`}
                    {...register("rg", { 
                      required: "RG é obrigatório",
                      validate: (value) => value.replace(/\D/g, "").length === 10 || "RG deve ter 10 dígitos",
                      onChange: (e) => {
                        e.target.value = formatRG(e.target.value);
                      }
                    })}
                  />
                  {errors.rg && <p className="text-xs text-red-600 mt-1">{errors.rg.message}</p>}
                </div>
              </div>

              {/* Senha e Estado Civil - Lado a lado */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="password" className="block text-xs font-medium text-gray-700 mb-1">
                    Senha
                  </label>
                  <input
                    id="password"
                    type="password"
                    placeholder="Min. 6 caracteres"
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 transition-all ${
                      errors.password 
                        ? 'border-red-500 focus:ring-red-500' 
                        : watchedPassword && watchedPassword.length >= 6
                        ? 'border-green-500 focus:ring-green-500'
                        : 'border-gray-300 focus:ring-gray-900 focus:border-transparent'
                    }`}
                    {...register("password", { 
                      required: "Senha é obrigatória", 
                      minLength: { value: 6, message: "Mínimo 6 caracteres" } 
                    })}
                  />
                  {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password.message}</p>}
                  {watchedPassword && watchedPassword.length > 0 && watchedPassword.length < 6 && (
                    <p className="text-xs text-amber-600 mt-1">Senha muito curta</p>
                  )}
                </div>
                <div>
                  <label htmlFor="civil_state" className="block text-xs font-medium text-gray-700 mb-1">
                    Estado Civil
                  </label>
                  <select
                    id="civil_state"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
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
                <button
                  type="submit"
                  className="w-full bg-linear-to-r from-gray-700 to-gray-900 text-white py-2.5 rounded-lg font-medium hover:from-gray-800 hover:to-black transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  Criar Conta
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="w-full text-sm text-gray-600 hover:text-gray-900 transition-colors"
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
