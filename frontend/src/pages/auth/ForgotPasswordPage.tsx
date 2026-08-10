import { useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { Link } from "react-router-dom";
import AuthBrandPanel from "../../components/shared/AuthBrandPanel";
import type { ForgotPasswordValues } from "../../types/types";
import api from "../../services/api";
import { Alert } from "../../components/ui/alert";

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
        "Se o e-mail estiver cadastrado, enviaremos o link.",
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
    <div className="sm:absolute w-screen h-screen flex flex-col sm:justify-between sm:items-center sm:flex-row-reverse">
      <AuthBrandPanel className="h-40 shrink-0 sm:h-full w-full sm:w-4/7" />

      <div className="sm:relative sm:left-8 flex flex-col gap-7 mx-13 sm:mx-0 sm:rounded-4xl sm:flex-col sm:w-1/2 sm:h-full sm:justify-center sm:gap-12 sm:px-36 sm:inset-y-0 sm:z-10 bg-bg">
        <div className="sm:relative sm:right-8 pt-8 flex flex-col justify-center items-center gap-3 sm:items-center sm:gap-4">
          <h1 className="text-2xl font-semibold sm:text-center sm:text-5xl">
            Recuperar senha
          </h1>
          <p className="text-sm text-center font-light sm:text-xl">
            Informe seu e-mail.
          </p>
        </div>

        {statusMessage ? (
          <div className="sm:relative sm:right-8 space-y-4">
            <Alert variant="success">{statusMessage}</Alert>
            <Link
              to="/login"
              className="block text-center text-sm text-muted hover:underline sm:text-base"
            >
              Voltar ao login
            </Link>
          </div>
        ) : (
          <form
            className="sm:relative sm:right-8"
            onSubmit={handleSubmit(onSubmit)}
          >
            <div className="flex flex-col gap-6 text-sm sm:text-xl sm:gap-7">
              <div className="flex flex-col gap-1 sm:gap-2">
                <label htmlFor="email">E-mail</label>
                <input
                  id="email"
                  type="email"
                  placeholder="Insira seu e-mail"
                  className="text-xs p-2 sm:p-3 bg-border rounded-md sm:rounded-xl sm:text-lg focus:outline-none focus:ring-2 focus:ring-focus-ring"
                  {...register("email", { required: true })}
                />
              </div>
            </div>

            {errorMessage ? (
              <Alert variant="danger" className="mt-4">
                {errorMessage}
              </Alert>
            ) : null}

            <div className="flex flex-col justify-center items-center gap-4 text-muted sm:gap-5 sm:pt-6 pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-md bg-ink-soft p-2 text-sm font-semibold text-border-soft transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60 sm:rounded-lg sm:text-xl"
              >
                {isSubmitting ? "Enviando..." : "Enviar link"}
              </button>

              <Link
                to="/login"
                className="text-xs text-muted hover:underline sm:text-base"
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
