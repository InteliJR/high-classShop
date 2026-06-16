import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  validateSpecialistInvite,
  registerSpecialist,
} from "../../services/specialists.service";
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
  const token = searchParams.get("invite") ?? "";

  const [speciality, setSpeciality] = useState<SpecialityType | null>(null);
  const [email, setEmail] = useState("");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(true);

  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [civilState, setCivilState] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

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

    const cleanCpf = cpf.replace(/\D/g, "");
    const cleanRg = rg.replace(/\D/g, "");
    const cleanPhone = phone.replace(/\D/g, "");

    if (!name.trim() || !surname.trim() || !cleanCpf || !cleanRg || !cleanPhone || !password) {
      setFormError("Todos os campos são obrigatórios.");
      return;
    }
    if (cleanCpf.length !== 11) {
      setFormError("CPF deve ter 11 dígitos.");
      return;
    }
    if (cleanRg.length < 7 || cleanRg.length > 10) {
      setFormError("RG deve ter entre 7 e 10 dígitos.");
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
      await registerSpecialist({
        invite_token: token,
        name: name.trim(),
        surname: surname.trim(),
        cpf: cleanCpf,
        rg: cleanRg,
        phone: cleanPhone,
        password,
        civil_state: civilState || undefined,
      });
      setSuccess(true);
    } catch (err) {
      setFormError((err as Error).message || "Erro ao criar conta. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Validando convite...</p>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-8 text-center">
          <h1 className="text-xl font-bold text-red-600 mb-2">Convite inválido</h1>
          <p className="text-gray-600">{tokenError}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-8 text-center">
          <h1 className="text-xl font-bold text-green-600 mb-2">
            Conta criada com sucesso!
          </h1>
          <p className="text-gray-600 mb-6">
            Sua conta de especialista em{" "}
            <strong>{speciality ? SPECIALITY_LABEL[speciality] : ""}</strong> foi criada.
          </p>
          <Button
            onClick={() =>
              navigate("/login", {
                state: { message: "Conta criada com sucesso! Faça login para continuar." },
              })
            }
          >
            Fazer Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Criar conta de Especialista
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          Especialidade:{" "}
          <strong>{speciality ? SPECIALITY_LABEL[speciality] : ""}</strong>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              E-mail (do convite)
            </label>
            <input
              type="email"
              value={email}
              readOnly
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nome</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Sobrenome</label>
              <input
                type="text"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">CPF (11 dígitos)</label>
            <input
              type="text"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              placeholder="12345678901"
              maxLength={14}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">RG (7-10 dígitos)</label>
            <input
              type="text"
              value={rg}
              onChange={(e) => setRg(e.target.value)}
              placeholder="1234567"
              maxLength={10}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Telefone (DDD + número)</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              maxLength={16}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Senha (mín. 6 caracteres)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Estado civil (opcional)</label>
            <select
              value={civilState}
              onChange={(e) => setCivilState(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
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

          {formError && <p className="text-sm text-red-500">{formError}</p>}

          <div className="pt-2">
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Criando conta..." : "Criar conta"}
            </Button>
          </div>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Já tem conta?{" "}
          <button onClick={() => navigate("/login")} className="text-blue-600 hover:underline">
            Fazer login
          </button>
        </p>
      </div>
    </div>
  );
}
