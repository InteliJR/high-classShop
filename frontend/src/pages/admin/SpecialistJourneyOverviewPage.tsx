import { Link } from "react-router-dom";
import { FileText, Package, UsersRound } from "lucide-react";
import { useAdminSpecialistJourney } from "../../contexts/AdminSpecialistJourneyContext";

export default function SpecialistJourneyOverviewPage() {
  const context = useAdminSpecialistJourney();
  if (!context) return null;

  const cards = [
    {
      to: "/admin/journey/products",
      icon: Package,
      title: "Catálogo",
      description: "Crie, edite e importe produtos do especialista, inclusive acompanhando inativos.",
    },
    {
      to: "/admin/journey/processes",
      icon: UsersRound,
      title: "Processos, agenda e reunião",
      description: "Acompanhe o cliente e execute somente as ações válidas para a etapa atual.",
    },
    {
      to: "/admin/journey/processes",
      icon: FileText,
      title: "Negociação e contrato",
      description: "Abra um processo para propor, revisar a timeline e preparar o contrato.",
    },
  ];

  return (
    <section>
      <h2 className="text-2xl font-semibold text-ink">
        Carteira de {context.specialist.name} {context.specialist.surname}
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Especialidade: {context.specialist.speciality}. A troca de especialista
        volta a esta visão e descarta contexto transitório de processo e preview.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {cards.map(({ to, icon: Icon, title, description }) => (
          <Link
            key={title}
            to={to}
            className="rounded-xl border border-border bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <Icon size={22} className="text-ink" />
            <h3 className="mt-3 font-semibold text-ink">{title}</h3>
            <p className="mt-1 text-sm text-ink-soft">{description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
