import LoginImageMobile from "../../assets/loginCarMobile.png";
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

  const { register, handleSubmit, setValue } = useForm<RegisterValues>({
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
      } catch (error) {
        setTokenError("Link de convite inválido ou expirado. Entre em contato com seu consultor para receber um novo convite.");
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
      <div className="w-screen h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          <p className="text-gray-600">Validando convite...</p>
        </div>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-background">
        <div className="max-w-md mx-4 p-8 bg-white rounded-2xl shadow-lg">
          <div className="flex flex-col items-center gap-4 text-center">
            <svg className="w-16 h-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-2xl font-semibold text-gray-900">Convite Inválido</h2>
            <p className="text-gray-600">{tokenError}</p>
            <button
              onClick={() => navigate("/login")}
              className="mt-4 px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Ir para Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sm:absolute w-screen h-screen flex flex-col sm:justify-between sm:items-center sm:flex-row-reverse">
      {/* Imagem */}
      <div className="h-1/3 shrink-0 sm:h-full w-full sm:w-4/7">
        <img
          srcSet={`${LoginImageMobile} 393w, ${LoginImageDesktop} 644w`}
          sizes="(max-width: 393px) 393px, 644px"
          src={LoginImageMobile}
          className="min-w-full h-full object-cover sm:object-cover"
          alt="Imagem de fundo"
        />
      </div>

      {/* Formulário de Registro */}
      <div className="sm:relative sm:left-8 flex flex-col gap-7 mx-13 sm:mx-0 sm:rounded-4xl sm:flex-col sm:w-1/2 sm:h-full sm:justify-center sm:gap-23 sm:px-36 sm:inset-y-0 sm:z-10 bg-background overflow-y-auto py-8">
        {/* Título da página */}
        <div className="sm:relative sm:right-8 flex flex-col justify-center items-center gap-3 sm:items-center sm:gap-8">
          <h1 className="text-2xl font-semibold sm:text-center sm:text-6xl">
            Bem-vindo!
          </h1>
          <p className="text-sm text-center font-light sm:text-2xl px-4">
            {consultantName && (
              <span className="block mb-2">
                <strong>{consultantName}</strong> te convidou para se cadastrar
              </span>
            )}
            Preencha suas informações para criar sua conta
          </p>
        </div>

        {/* Formulário */}
        <form
          className="sm:relative sm:right-8"
          onSubmit={handleSubmit(onSubmit, onError)}
        >
          <div className="flex flex-col gap-6 text-sm sm:text-2xl sm:gap-8">
            {/* Nome */}
            <div className="flex flex-col gap-1 sm:gap-2">
              <label htmlFor="name">Nome</label>
              <input
                id="name"
                type="text"
                placeholder="Insira seu nome"
                className="text-xs p-2 sm:p-4 bg bg-color-input rounded-md sm:rounded-xl sm:text-xl"
                {...register("name", { required: true, minLength: 2 })}
              />
            </div>

            {/* Sobrenome */}
            <div className="flex flex-col gap-1 sm:gap-2">
              <label htmlFor="surname">Sobrenome</label>
              <input
                id="surname"
                type="text"
                placeholder="Insira seu sobrenome"
                className="text-xs p-2 sm:p-4 bg bg-color-input rounded-md sm:rounded-xl sm:text-xl"
                {...register("surname", { required: true, minLength: 2 })}
              />
            </div>

            {/* E-mail */}
            <div className="flex flex-col gap-1 sm:gap-2">
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                placeholder="Insira seu e-mail"
                className="text-xs p-2 sm:p-4 bg bg-color-input rounded-md sm:rounded-xl sm:text-xl"
                disabled
                {...register("email", { required: true })}
              />
              <p className="text-xs text-gray-500 sm:text-sm">
                E-mail vinculado ao convite
              </p>
            </div>

            {/* CPF */}
            <div className="flex flex-col gap-1 sm:gap-2">
              <label htmlFor="cpf">CPF</label>
              <input
                id="cpf"
                type="text"
                placeholder="000.000.000-00"
                maxLength={14}
                className="text-xs p-2 sm:p-4 bg bg-color-input rounded-md sm:rounded-xl sm:text-xl"
                {...register("cpf", { 
                  required: true,
                  onChange: (e) => {
                    e.target.value = formatCPF(e.target.value);
                  }
                })}
              />
            </div>

            {/* RG */}
            <div className="flex flex-col gap-1 sm:gap-2">
              <label htmlFor="rg">RG</label>
              <input
                id="rg"
                type="text"
                placeholder="0000000000"
                maxLength={10}
                className="text-xs p-2 sm:p-4 bg bg-color-input rounded-md sm:rounded-xl sm:text-xl"
                {...register("rg", { 
                  required: true,
                  onChange: (e) => {
                    e.target.value = formatRG(e.target.value);
                  }
                })}
              />
            </div>

            {/* Senha */}
            <div className="flex flex-col gap-1 sm:gap-2">
              <label htmlFor="password">Senha</label>
              <input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                className="text-xs p-2 sm:p-4 bg bg-color-input rounded-md sm:rounded-xl sm:text-xl"
                {...register("password", { required: true, minLength: 6 })}
              />
            </div>

            {/* Estado Civil (Opcional) */}
            <div className="flex flex-col gap-1 sm:gap-2">
              <label htmlFor="civil_state">Estado Civil (Opcional)</label>
              <select
                id="civil_state"
                className="text-xs p-2 sm:p-4 bg bg-color-input rounded-md sm:rounded-xl sm:text-xl"
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

          {/* Botão de ações */}
          <div className="flex flex-col justify-center items-center gap-4 text-color-a sm:gap-8 sm:pt-8 pt-4">
            <button
              type="submit"
              className="text-sm bg-gray-700 p-2 w-full text-white rounded-md sm:text-2xl sm:rounded-lg hover:bg-gray-800 transition-colors"
            >
              Cadastrar
            </button>
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="text-xs text-gray-600 sm:text-base hover:text-gray-900"
            >
              Já tem uma conta? Faça login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
