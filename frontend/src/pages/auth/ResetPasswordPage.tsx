import { useEffect, useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import LoginImageMobile from "../../assets/loginCarMobile.png";
import LoginImageDesktop from "../../assets/loginCarDesktop.png";
import type { ResetPasswordValues } from "../../types/types";
import api from "../../services/api";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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
        "Senha redefinida com sucesso. Faca login com sua nova senha.",
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
            Nova senha
          </h1>
          <p className="text-sm text-center font-light sm:text-2xl">
            Insira uma nova senha e confirme para concluir a recuperacao.
          </p>
        </div>

        {!token ? (
          <div className="sm:relative sm:right-8 space-y-4">
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:rounded-xl sm:text-base">
              O link de redefinicao esta invalido ou expirou.
            </div>
            <Link
              to="/forgot-password"
              className="block text-center rounded-md bg-background-secondary p-2 text-sm font-semibold text-color-text-secondary hover:bg-gray-500 sm:rounded-lg sm:text-2xl"
            >
              Solicitar novo link
            </Link>
          </div>
        ) : statusMessage ? (
          <div className="sm:relative sm:right-8 space-y-4">
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 sm:rounded-xl sm:text-base">
              {statusMessage}
            </div>
            <button
              onClick={() => navigate("/login")}
              className="w-full rounded-md bg-background-secondary p-2 text-sm font-semibold text-color-text-secondary hover:bg-gray-500 sm:rounded-lg sm:text-2xl"
            >
              Ir para login
            </button>
          </div>
        ) : (
          <form
            className="sm:relative sm:right-8"
            onSubmit={handleSubmit(onSubmit)}
          >
            <div className="flex flex-col gap-6 text-sm sm:text-2xl sm:gap-12">
              <div className="flex flex-col gap-1 sm:gap-2">
                <label htmlFor="new_password">Nova senha</label>
                <input
                  id="new_password"
                  type="password"
                  placeholder="Minimo 6 caracteres"
                  className="text-xs p-2 sm:p-4 bg-color-input rounded-md sm:rounded-xl sm:text-xl"
                  {...register("new_password", { required: true, minLength: 6 })}
                />
                {errors.new_password ? (
                  <p className="text-xs text-red-600 sm:text-sm">
                    A senha precisa ter ao menos 6 caracteres.
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1 sm:gap-2">
                <label htmlFor="confirm_password">Confirmar senha</label>
                <input
                  id="confirm_password"
                  type="password"
                  placeholder="Repita a nova senha"
                  className="text-xs p-2 sm:p-4 bg-color-input rounded-md sm:rounded-xl sm:text-xl"
                  {...register("confirm_password", {
                    required: true,
                    minLength: 6,
                    validate: (value) => value === watch("new_password"),
                  })}
                />
                {errors.confirm_password ? (
                  <p className="text-xs text-red-600 sm:text-sm">
                    As senhas precisam coincidir.
                  </p>
                ) : null}
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
                {isSubmitting ? "Redefinindo..." : "Redefinir senha"}
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
