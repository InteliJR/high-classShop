import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "../../lib/utils";

export function BackButton({
  to,
  label = "Voltar",
  className,
}: {
  to?: string;
  label?: string;
  className?: string;
}) {
  const navigate = useNavigate();
  const classes = cn(
    "inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink w-fit",
    className
  );

  if (to) {
    return (
      <Link to={to} className={classes}>
        <ArrowLeft size={16} />
        {label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => navigate(-1)} className={classes}>
      <ArrowLeft size={16} />
      {label}
    </button>
  );
}
