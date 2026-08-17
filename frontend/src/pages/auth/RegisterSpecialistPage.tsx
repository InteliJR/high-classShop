import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  validateSpecialistInvite,
  registerSpecialist,
} from "../../services/specialists.service";
import { getCalendlyAuthorizeUrl } from "../../services/appointments.service";
import { useAuth } from "../../store/authStateManager";
import { applyCnpjMask, applyRgMask, applyPhoneMask } from "../../utils/mask";
import Button from "../../components/ui/button";

type SpecialityType = "CAR" | "BOAT" | "AIRCRAFT";

const SPECIALITY_LABEL: Record<SpecialityType, string> = {
  CAR: "Carros",
  BOAT: "Embarcações",
  AIRCRAFT: "Aeronaves",
};

export default function RegisterSpecialistPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAccessToken, setUser } = useAuth();
  const token = searchParams.get("invite") ?? "";

  const [speciality, setSpeciality] = useState<SpecialityType | null>(null);
  const [email, setEmail] = useState("");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(true);

  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [rg, setRg] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [civilState, setCivilState] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [connectingCalendly, setConnectingCalendly] = useState(false);
  const [calendlyError, setCalendlyError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setTokenError("Link de convite inválido ou ausente.");
      setIsValidating(false);
      return;
    }
    validateSpecialistInvite(token)
      .then((data) => {
        setSpeciality(data.speciality);
        setEmail(data.email);
        setIsValidating(false);
      })
      .catch(() => {
        setTokenError(
          "Link de convite inválido ou expirado. Solicite um novo convite ao administrador.",
        );
        setIsValidating(false);
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanCnpj = cnpj.replace(/\D/g, "");
    const cleanRg = rg.replace(/\D/g, "");
    const cleanPhone = phone.replace(/\D/g, "");

    if (!name.trim() || !surname.trim() || !cleanCnpj || !cleanRg || !cleanPhone || !password) {
      setFormError("Todos os campos são obrigatórios.");
      return;
    }
    if (cleanCnpj.length !== 14) {
      setFormError("CNPJ deve ter 14 dígitos.");
      return;
    }
    if (cleanRg.length < 7 || cleanRg.length > 11) {
      setFormError("RG deve ter entre 7 e 11 dígitos.");
      return;
    }
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      setFormError("Telefone deve ter 10 ou 11 dígitos.");
      return;
    }
    if (password.length < 6) {
      setFormError("Senha deve ter no mínimo 6 caracteres.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { access_token, user } = await registerSpecialist({
        invite_token: token,
        name: name.trim(),
        surname: surname.trim(),
        cnpj: cleanCnpj,
        rg: cleanRg,
        phone: cleanPhone,
        password,
        civil_state: civilState || undefined,
      });
      setAccessToken(access_token);
      setUser(user);
      setSuccess(true);
    } catch (err) {
      setFormError((err as Error).message || "Erro ao criar conta. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConnectCalendly = async () => {
    setConnectingCalendly(true);
    setCalendlyError(null);
    try {
      const authorizeUrl = await getCalendlyAuthorizeUrl();
      window.location.href = authorizeUrl;
    } catch {
      setCalendlyError("Não foi possível iniciar a conexão com o Calendly. Tente novamente pelo seu perfil.");
      setConnectingCalendly(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <p className="text-muted">Validando convite...</p>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="max-w-md w-full bg-surface rounded-lg shadow-ds-card p-8 text-center">
          <h1 className="text-xl font-bold text-status-bad mb-2">Convite inválido</h1>
          <p className="text-muted">{tokenError}</p>
          <Button onClick={() => navigate("/login")} className="mt-4">
            Ir para Login
          </Button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="max-w-md w-full bg-surface rounded-lg shadow-ds-card p-8 text-center">
          <h1 className="text-xl font-bold text-status-ok mb-2">
            Conta criada com sucesso!
          </h1>
          <p className="text-muted mb-6">
            Sua conta de especialista em{" "}
            <strong>{speciality ? SPECIALITY_LABEL[speciality] : ""}</strong> foi criada.
            Conecte seu Calendly para poder anunciar produtos na plataforma.
          </p>
          {calendlyError && (
            <p className="text-sm text-status-bad mb-4">{calendlyError}</p>
          )}
          <div className="space-y-2">
            <Button
              onClick={handleConnectCalendly}
              disabled={connectingCalendly}
              className="w-full"
            >
              {connectingCalendly ? "Conectando..." : "Conectar Calendly agora"}
            </Button>
            <button
              type="button"
              onClick={() => navigate("/specialist/dashboard")}
              disabled={connectingCalendly}
              className="w-full text-sm text-muted hover:underline disabled:opacity-50"
            >
              Depois
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg py-12 px-4">
      <div className="max-w-md w-full bg-surface rounded-lg shadow-ds-card p-8">
        <h1 className="text-2xl font-bold text-ink mb-1">
          Criar conta de Especialista
        </h1>
        <p className="text-sm text-muted mb-6">
          Especialidade:{" "}
          <strong>{speciality ? SPECIALITY_LABEL[speciality] : ""}</strong>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-soft">
              E-mail (do convite)
            </label>
            <input
              type="email"
              value={email}
              readOnly
              className="mt-1 block w-full px-3 py-2 border border-border rounded-md bg-border-soft text-muted cursor-not-allowed"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-soft">Nome</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-focus-ring"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-soft">Sobrenome</label>
              <input
                type="text"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-focus-ring"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-soft">CNPJ (14 dígitos)</label>
            <input
              type="text"
              value={cnpj}
              onChange={(e) => setCnpj(applyCnpjMask(e.target.value))}
              placeholder="12345678000199"
              maxLength={18}
              className="mt-1 block w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-focus-ring"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-soft">RG (7-11 dígitos, aceita CPF)</label>
            <input
              type="text"
              value={rg}
              onChange={(e) => setRg(applyRgMask(e.target.value))}
              placeholder="1234567"
              maxLength={14}
              className="mt-1 block w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-focus-ring"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-soft">Telefone (DDD + número)</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(applyPhoneMask(e.target.value))}
              placeholder="(11) 99999-9999"
              maxLength={16}
              className="mt-1 block w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-focus-ring"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-soft">Senha (mín. 6 caracteres)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              className="mt-1 block w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-focus-ring"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-soft">Estado civil (opcional)</label>
            <select
              value={civilState}
              onChange={(e) => setCivilState(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-border rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-focus-ring"
            >
              <option value="">Não informar</option>
              <option value="SINGLE">Solteiro(a)</option>
              <option value="MARRIED">Casado(a)</option>
              <option value="DIVORCED">Divorciado(a)</option>
              <option value="WIDOWED">Viúvo(a)</option>
              <option value="SEPARATED">Separado(a)</option>
              <option value="STABLE_UNION">União Estável</option>
            </select>
          </div>

          {formError && <p className="text-sm text-status-bad">{formError}</p>}

          <div className="pt-2">
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Criando conta..." : "Criar conta"}
            </Button>
          </div>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          Já tem conta?{" "}
          <button onClick={() => navigate("/login")} className="text-ink-soft hover:underline">
            Fazer login
          </button>
        </p>
      </div>
    </div>
  );
}
