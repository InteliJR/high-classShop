import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getCompanyBySlug } from "../../services/companies.service";
import { useWhitelabel } from "../../store/whitelabelStore";
import { resolveCompanyLogo } from "../../utils/branding";
import Button from "../../components/ui/button";

export default function WhitelabelPage() {
  const { slug } = useParams<{ slug: string }>();
  const setCompany = useWhitelabel((s) => s.setCompany);
  const company = useWhitelabel((s) => s.company);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!slug) return;
    getCompanyBySlug(slug)
      .then(setCompany)
      .catch(() => setError("Escritório não encontrado."));
  }, [slug, setCompany]);

  if (error) return <div className="p-8 text-status-bad">{error}</div>;
  if (!company) return <div className="p-8 text-muted">Carregando...</div>;

  const logo = resolveCompanyLogo(company);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-brand-primary text-brand-primary-fg p-8">
      {logo && <img src={logo} alt={company.name} className="h-20 object-contain" />}
      <h1 className="text-2xl font-semibold">{company.name}</h1>
      <p className="opacity-80 max-w-md text-center">
        Explore nosso catálogo exclusivo e crie sua conta com nosso escritório.
      </p>
      <div className="flex gap-3">
        <Button onClick={() => navigate("/catalog/cars")}>Ver catálogo</Button>
        <Button onClick={() => navigate("/register")}>Criar conta</Button>
      </div>
    </div>
  );
}
