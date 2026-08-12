import { useEffect, useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { useSearchParams, Link } from "react-router-dom";
import AuthBrandPanel from "../../components/shared/AuthBrandPanel";
import type { ResetPasswordValues } from "../../types/types";
import api from "../../services/api";
import { Alert } from "../../components/ui/alert";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordValues>({
    defaultValues: {
      new_password: "",
      confirm_password: "",
    },
  });

  useEffect(() => {
    if (!token) {
      setErrorMessage("Token de redefinicao ausente ou invalido.");
    }
  }, [token]);

  const onSubmit: SubmitHandler<ResetPasswordValues> = async (data) => {
    setErrorMessage("");
    setIsSubmitting(true);

    if (!token) {
      setErrorMessage("Token de redefinicao ausente ou invalido.");
      setIsSubmitting(false);
      return;
    }

    try {
      await api.post("auth/reset-password", {
        token,
        new_password: data.new_password,
        confirm_password: data.confirm_password,
      });
      setStatusMessage(
        "Senha redefinida. Faca login novamente.",
      );
    } catch (error: any) {
      setErrorMessage(
        error?.response?.data?.message ||
          error?.friendlyMessage ||
          "Nao foi possivel redefinir a senha. Verifique o link ou tente novamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="sm:absolute w-screen h-screen flex flex-col sm:justify-between sm:items-center sm:flex-row-reverse">
      <AuthBrandPanel className="h-40 shrink-0 sm:h-full w-full sm:w-4/7" />

      <div className="sm:relative sm:left-8 flex flex-col gap-7 mx-13 sm:mx-0 sm:rounded-4xl sm:flex-col sm:w-1/2 sm:h-full sm:justify-center sm:gap-10 sm:px-36 sm:inset-y-0 sm:z-10 bg-bg">
        <div className="sm:relative sm:right-8 pt-8 flex flex-col justify-center items-center gap-3 sm:items-center sm:gap-4">
          <h1 className="text-2xl font-semibold sm:text-center sm:text-5xl">
            Nova senha
          </h1>
          <p className="text-sm text-center font-light sm:text-xl">
            Crie uma nova senha.
          </p>
        </div>

        {!token ? (
          <div className="sm:relative sm:right-8 space-y-4">
            <Alert variant="danger">Link invalido ou expirado.</Alert>
            <Link
              to="/forgot-password"
              className="block text-center rounded-md bg-ink-soft p-2 text-sm font-semibold text-border-soft hover:bg-ink sm:rounded-lg sm:text-xl"
            >
              Solicitar novo link
            </Link>
          </div>
        ) : statusMessage ? (
          <div className="sm:relative sm:right-8 space-y-4">
            <Alert variant="success">{statusMessage}</Alert>
            <Link
              to="/login"
              reloadDocument
              className="block text-center text-xs text-muted hover:underline sm:text-base"
            >
              Ir para login
            </Link>
          </div>
        ) : (
          <form
            className="sm:relative sm:right-8"
            onSubmit={handleSubmit(onSubmit)}
          >
            <div className="flex flex-col gap-5 text-sm sm:text-xl sm:gap-6">
              <div className="flex flex-col gap-1 sm:gap-2">
                <label htmlFor="new_password">Nova senha</label>
                <input
                  id="new_password"
                  type="password"
                  placeholder="Minimo 6 caracteres"
                  className="text-xs p-2 sm:p-3 bg-border rounded-md sm:rounded-xl sm:text-lg focus:outline-none focus:ring-2 focus:ring-focus-ring"
                  {...register("new_password", { required: true, minLength: 6 })}
                />
                {errors.new_password ? (
                  <p className="text-xs text-status-bad sm:text-sm">
                    Minimo de 6 caracteres.
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1 sm:gap-2">
                <label htmlFor="confirm_password">Confirmar senha</label>
                <input
                  id="confirm_password"
                  type="password"
                  placeholder="Repita a nova senha"
                  className="text-xs p-2 sm:p-3 bg-border rounded-md sm:rounded-xl sm:text-lg focus:outline-none focus:ring-2 focus:ring-focus-ring"
                  {...register("confirm_password", {
                    required: true,
                    minLength: 6,
                    validate: (value) => value === watch("new_password"),
                  })}
                />
                {errors.confirm_password ? (
                  <p className="text-xs text-status-bad sm:text-sm">
                    As senhas devem coincidir.
                  </p>
                ) : null}
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
                {isSubmitting ? "Redefinindo..." : "Redefinir senha"}
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
