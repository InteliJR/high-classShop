import { useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { Link } from "react-router-dom";
import LoginImageMobile from "../../assets/loginCarMobile.png";
import LoginImageDesktop from "../../assets/loginCarDesktop.png";
import type { ForgotPasswordValues } from "../../types/types";
import api from "../../services/api";

export default function ForgotPasswordPage() {
  const { register, handleSubmit } = useForm<ForgotPasswordValues>({
    defaultValues: {
      email: "",
    },
  });
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit: SubmitHandler<ForgotPasswordValues> = async (data) => {
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await api.post("auth/forgot-password", {
        email: data.email,
      });
      setStatusMessage(
        "Se o e-mail estiver cadastrado, voce recebera instrucoes para redefinir sua senha.",
      );
    } catch (error: any) {
      setErrorMessage(
        error?.friendlyMessage ||
          error?.response?.data?.message ||
          "Nao foi possivel enviar o e-mail. Tente novamente mais tarde.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="sm:absolute w-screen min-h-screen flex flex-col sm:h-screen sm:justify-between sm:items-center sm:flex-row-reverse">
      <div className="h-1/3 shrink-0 sm:h-full w-full sm:w-4/7">
        <img
          srcSet={`${LoginImageMobile} 393w, ${LoginImageDesktop} 644w`}
          sizes="(max-width: 393px) 393px, 644px"
          src={LoginImageMobile}
          className="min-w-full h-full object-cover sm:object-cover"
        />
      </div>

      <div className="sm:relative sm:left-8 flex flex-col gap-7 mx-13 sm:mx-0 sm:rounded-4xl sm:flex-col sm:w-1/2 sm:h-full sm:justify-center sm:gap-12 sm:px-36 sm:inset-y-0 sm:z-10 bg-background">
        <div className="sm:relative sm:right-8 pt-8 flex flex-col justify-center items-center gap-3 sm:items-center sm:gap-8">
          <h1 className="text-2xl font-semibold sm:text-center sm:text-6xl">
            Recuperar senha
          </h1>
          <p className="text-sm text-center font-light sm:text-2xl">
            Enviaremos um link de redefinicao de senha para o seu e-mail.
          </p>
        </div>

        {statusMessage ? (
          <div className="sm:relative sm:right-8 space-y-4">
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 sm:rounded-xl sm:text-base">
              {statusMessage}
            </div>
            <Link
              to="/login"
              className="block text-center text-sm text-color-a hover:underline sm:text-base"
            >
              Voltar ao login
            </Link>
          </div>
        ) : (
          <form
            className="sm:relative sm:right-8"
            onSubmit={handleSubmit(onSubmit)}
          >
            <div className="flex flex-col gap-6 text-sm sm:text-2xl sm:gap-12">
              <div className="flex flex-col gap-1 sm:gap-2">
                <label htmlFor="email">E-mail</label>
                <input
                  id="email"
                  type="email"
                  placeholder="Insira seu e-mail"
                  className="text-xs p-2 sm:p-4 bg-color-input rounded-md sm:rounded-xl sm:text-xl"
                  {...register("email", { required: true })}
                />
              </div>
            </div>

            {errorMessage ? (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:rounded-xl">
                {errorMessage}
              </div>
            ) : null}

            <div className="flex flex-col justify-center items-center gap-4 text-color-a sm:gap-8 sm:pt-8 pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-md bg-background-secondary p-2 text-sm font-semibold text-color-text-secondary transition hover:bg-gray-500 disabled:cursor-not-allowed disabled:opacity-60 sm:rounded-lg sm:text-2xl"
              >
                {isSubmitting ? "Enviando..." : "Enviar link de recuperacao"}
              </button>

              <Link
                to="/login"
                className="text-xs text-color-a hover:underline sm:text-base"
              >
                Voltar ao login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
