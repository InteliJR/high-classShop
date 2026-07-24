import { useEffect, useState } from "react";
import { officeService, type OfficeCompany } from "../../services/office";
import Button from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { PageHeader } from "../../components/patterns/PageHeader";
import { resolveCompanyLogo } from "../../utils/branding";

const DEFAULT_COLORS = ["#1a1a1a", "#3b82f6", "#10b981", "#f59e0b"];

export default function OfficeCompanySettingsPage() {
  const [company, setCompany] = useState<OfficeCompany | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [form, setForm] = useState<Partial<OfficeCompany>>({});

  useEffect(() => {
    officeService
      .getCompany()
      .then((c) => {
        setCompany(c);
        setForm({
          name: c.name,
          description: c.description ?? "",
          cnpj: c.cnpj,
          bank: c.bank ?? "",
          agency: c.agency ?? "",
          checking_account: c.checking_account ?? "",
          color_identity: c.color_identity?.length ? c.color_identity : DEFAULT_COLORS,
        });
      })
      .catch(() => setMsg({ ok: false, text: "Erro ao carregar escritório" }))
      .finally(() => setLoading(false));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const updated = await officeService.updateCompany(form);
      setCompany(updated);
      setMsg({ ok: true, text: "Configurações salvas." });
    } catch (err) {
      setMsg({
        ok: false,
        text:
          (err as { friendlyMessage?: string; response?: { data?: { message?: string } } })
            .friendlyMessage ||
          (err as { response?: { data?: { message?: string } } }).response?.data?.message ||
          "Erro ao salvar",
      });
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file: File) => {
    setUploading(true);
    setMsg(null);
    try {
      const updated = await officeService.uploadLogo(file);
      if (company) {
        setCompany({
          ...company,
          logo: updated.logo,
          logoUrl: updated.logoUrl,
        });
      }
      setMsg({ ok: true, text: "Logo enviado." });
    } catch (err) {
      setMsg({
        ok: false,
        text:
          (err as { friendlyMessage?: string; response?: { data?: { message?: string } } })
            .friendlyMessage ||
          (err as { response?: { data?: { message?: string } } }).response?.data?.message ||
          "Logo inválido. Aceitos: PNG, JPEG, WebP (≤2MB) ou SVG sanitizado (≤500KB).",
      });
    } finally {
      setUploading(false);
    }
  };

  const setColor = (idx: number, value: string) => {
    const next = [...(form.color_identity ?? DEFAULT_COLORS)];
    next[idx] = value;
    setForm({ ...form, color_identity: next });
  };

  if (loading) return <div className="p-8 text-muted">Carregando...</div>;
  if (!company) return null;

  return (
    <div className="p-8 max-w-3xl">
      <PageHeader title="Configurações do escritório" />

      {msg && (
        <p className={`mb-4 text-sm ${msg.ok ? "text-status-ok" : "text-status-bad"}`}>{msg.text}</p>
      )}

      <Card className="mb-6">
        <h2 className="text-h2 font-semibold text-ink mb-4">Logo</h2>
        <div className="flex items-center gap-4">
          {(() => {
            const src = resolveCompanyLogo(company);
            return src ? (
              <img
                src={src}
                alt={`Logo ${company.name}`}
                className="w-24 h-24 border border-border rounded object-contain bg-border-soft"
              />
            ) : (
              <div className="w-24 h-24 border border-dashed border-border rounded bg-border-soft flex items-center justify-center text-xs text-subtle">
                Sem logo
              </div>
            );
          })()}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            disabled={uploading}
            onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
            className="text-sm"
          />
        </div>
        <p className="text-xs text-muted mt-2">
          PNG, JPEG, WebP (≤2MB) ou SVG sanitizado (≤500KB). SVG passa por DOMPurify antes de salvar.
        </p>
      </Card>

      <Card>
        <form onSubmit={save} className="space-y-4">
          <Field label="Nome do escritório">
            <input
              type="text"
              value={form.name ?? ""}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-md"
              required
            />
          </Field>

          <Field label="Descrição">
            <textarea
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-md"
            />
          </Field>

          <Field label="CNPJ">
            <input
              type="text"
              value={form.cnpj ?? ""}
              onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
              placeholder="14 dígitos ou XX.XXX.XXX/XXXX-XX"
              className="w-full px-3 py-2 border border-border rounded-md"
            />
          </Field>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Banco">
              <input
                type="text"
                value={form.bank ?? ""}
                onChange={(e) => setForm({ ...form, bank: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md"
              />
            </Field>
            <Field label="Agência">
              <input
                type="text"
                value={form.agency ?? ""}
                onChange={(e) => setForm({ ...form, agency: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md"
              />
            </Field>
            <Field label="Conta corrente">
              <input
                type="text"
                value={form.checking_account ?? ""}
                onChange={(e) => setForm({ ...form, checking_account: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md"
              />
            </Field>
          </div>

          <Field label="Comissão padrão (%)">
            <div className="w-full px-3 py-2 bg-border-soft border border-border rounded-md text-ink-soft">
              {company.commission_rate != null ? `${company.commission_rate}%` : "—"}
            </div>
            <p className="text-xs text-muted mt-1">
              Somente o administrador pode alterar a comissão do escritório.
            </p>
          </Field>

          <Field label="Identidade visual (até 4 cores hex)">
            <div className="grid grid-cols-4 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <input
                  key={i}
                  type="color"
                  value={form.color_identity?.[i] ?? DEFAULT_COLORS[i]}
                  onChange={(e) => setColor(i, e.target.value)}
                  className="h-10 w-full border border-border rounded"
                />
              ))}
            </div>
          </Field>

          <Button type="submit" disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink-soft mb-1">{label}</label>
      {children}
    </div>
  );
}
