// Fotmulário para criar um novo escritório dentro do modal

import React, { useState, useEffect } from "react";
import Button from "../../components/ui/button";
import {
  createCompany,
  updateCompany,
  type Company,
} from "../../services/companies.service";
import { resolveCompanyLogo } from "../../utils/branding";

const LOGO_MAX_BYTES = 2 * 1024 * 1024; // 2MB
const LOGO_ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
];

interface NewCompanyFormProps {
  onSuccess: () => void;
  companyToEdit?: Company | null;
}

export default function NewCompanyForm({
  onSuccess,
  companyToEdit,
}: NewCompanyFormProps) {
  // Guarda o valor do campo "Nome do Escritório".
  const [name, setName] = useState("");
  // Guarda o valor do campo "CNPJ".
  const [cnpj, setCnpj] = useState("");
  // Guarda o ficheiro de imagem selecionado pelo utilizador. Começa como nulo.
  const [logo, setLogo] = useState<File | null>(null);
  // Taxa de comissão do escritório (opcional)
  const [commissionRate, setCommissionRate] = useState("");
  // Dados bancários opcionais
  const [bank, setBank] = useState("");
  const [agency, setAgency] = useState("");
  const [checkingAccount, setCheckingAccount] = useState("");
  // Identidade visual (whitelabel) — até 4 cores em hexadecimal
  const DEFAULT_COLOR_IDENTITY = ["#000000", "#FFFFFF", "#888888", "#CCCCCC"];
  const COLOR_LABELS = [
    "Cor primária",
    "Cor secundária",
    "Cor de destaque",
    "Cor neutra",
  ];
  const [colorIdentity, setColorIdentity] = useState<string[]>(
    DEFAULT_COLOR_IDENTITY,
  );
  // Controla se o formulário está a ser enviado, para desativar o botão e evitar cliques duplos.
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Guarda qualquer mensagem de erro que ocorra durante a validação ou o envio.
  const [error, setError] = useState<string | null>(null);

  // Preenche o formulário com os dados da empresa sendo editada
  useEffect(() => {
    if (companyToEdit) {
      setName(companyToEdit.name);
      setCnpj(companyToEdit.cnpj);
      setCommissionRate(
        companyToEdit.commission_rate != null
          ? String(companyToEdit.commission_rate)
          : "",
      );
      setBank(companyToEdit.bank || "");
      setAgency(companyToEdit.agency || "");
      setCheckingAccount(companyToEdit.checking_account || "");
      const existing = companyToEdit.color_identity;
      if (existing && existing.length > 0) {
        // Garante array com 4 slots, completando com defaults se faltar.
        const filled = [...existing];
        while (filled.length < 4) {
          filled.push(DEFAULT_COLOR_IDENTITY[filled.length]);
        }
        setColorIdentity(filled.slice(0, 4));
      } else {
        setColorIdentity(DEFAULT_COLOR_IDENTITY);
      }
    } else {
      setName("");
      setCnpj("");
      setLogo(null);
      setCommissionRate("");
      setBank("");
      setAgency("");
      setCheckingAccount("");
      setColorIdentity(DEFAULT_COLOR_IDENTITY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyToEdit]);

  // Atualiza apenas uma cor do array no índice informado, mantendo as outras.
  const handleColorChange = (index: number, value: string) => {
    setColorIdentity((prev) => {
      const next = [...prev];
      next[index] = value.toUpperCase();
      return next;
    });
  };

  /**
   * Converte um arquivo File para base64 string.
   * Necessário para enviar a imagem do logo como JSON para o backend.
   */
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove o prefixo "data:image/...;base64," para enviar apenas o base64
        const base64String = result.split(",")[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  /**
   * Valida o formato do CNPJ (apenas números, 14 dígitos)
   */
  const validateCNPJ = (cnpj: string): boolean => {
    const cleanCNPJ = cnpj.replace(/\D/g, "");
    return cleanCNPJ.length === 14;
  };

  /**
   * Função chamada quando o utilizador clica no botão "Salvar Escritório".
   * É responsável por validar, preparar e enviar os dados para a API.
   * Suporta tanto criação quanto edição de empresas.
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Validações
    if (!name || !cnpj) {
      setError("Nome e CNPJ são obrigatórios.");
      return;
    }

    if (!validateCNPJ(cnpj)) {
      setError("CNPJ deve conter exatamente 14 dígitos numéricos.");
      return;
    }

    // Valida que todas as cores estão em formato hexadecimal válido.
    const hexRegex = /^#[0-9a-fA-F]{6}$/;
    if (!colorIdentity.every((c) => hexRegex.test(c))) {
      setError(
        "Todas as cores devem estar no formato hexadecimal válido (ex: #FF5733)",
      );
      return;
    }

    if (logo) {
      if (!LOGO_ALLOWED_TYPES.includes(logo.type)) {
        setError("Logo inválido. Aceitos: PNG, JPEG, WebP ou SVG.");
        return;
      }
      if (logo.size > LOGO_MAX_BYTES) {
        setError("Logo excede o limite de 2MB.");
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Remove formatação do CNPJ antes de enviar
      const cleanCNPJ = cnpj.replace(/\D/g, "");

      const parsedRate = commissionRate
        ? parseFloat(commissionRate)
        : undefined;

      // Converte o ficheiro selecionado para base64 — usado em create e update.
      const logoBase64 = logo ? await fileToBase64(logo) : undefined;

      if (companyToEdit) {
        await updateCompany(companyToEdit.id, {
          name,
          cnpj: cleanCNPJ,
          commission_rate: parsedRate,
          bank: bank || undefined,
          agency: agency || undefined,
          checking_account: checkingAccount || undefined,
          color_identity: colorIdentity,
          logo: logoBase64,
        });
      } else {
        await createCompany({
          name,
          cnpj: cleanCNPJ,
          logo: logoBase64,
          commission_rate: parsedRate,
          bank: bank || undefined,
          agency: agency || undefined,
          checking_account: checkingAccount || undefined,
          color_identity: colorIdentity,
        });
      }
      onSuccess();
    } catch (err) {
      console.error("Erro capturado:", err);
      setError(
        (err as Error).message || "Falha ao salvar a empresa. Tente novamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="h2-style">
        {companyToEdit ? "Editar Escritório" : "Novo Escritório"}
      </h2>

      <div>
        {/* --- CAMPO NOME --- */}
        <label
          htmlFor="name"
          className="block text-sm font-medium text-text-secondary"
        >
          Nome do Escritório
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm focus:outline-none focus:ring-brand-dark focus:border-brand-dark"
          required
        />
      </div>

      <div>
        {/* --- CAMPO CNPJ --- */}
        <label
          htmlFor="cnpj"
          className="block text-sm font-medium text-text-secondary"
        >
          CNPJ (apenas números)
        </label>
        <input
          id="cnpj"
          type="text"
          value={cnpj}
          onChange={(e) => setCnpj(e.target.value)}
          placeholder="12345678901234"
          maxLength={18}
          className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm focus:outline-none focus:ring-brand-dark focus:border-brand-dark"
          required
        />
        <p className="text-xs text-gray-500 mt-1">
          Digite 14 dígitos numéricos
        </p>
      </div>

      <div>
        {/* --- CAMPO TAXA DE COMISSÃO --- */}
        <label
          htmlFor="commission_rate"
          className="block text-sm font-medium text-text-secondary"
        >
          Taxa de Comissão (%)
        </label>
        <input
          id="commission_rate"
          type="number"
          step="0.01"
          min="0"
          max="100"
          value={commissionRate}
          onChange={(e) => setCommissionRate(e.target.value)}
          placeholder="Ex: 15.00"
          className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm focus:outline-none focus:ring-brand-dark focus:border-brand-dark"
        />
        <p className="text-xs text-gray-500 mt-1">
          Opcional. Especialistas desta empresa usarão esta taxa.
        </p>
      </div>

      {/* --- DADOS BANCÁRIOS (OPCIONAIS) --- */}
      <div className="border-t pt-4 mt-4">
        <p className="text-sm font-medium text-text-secondary mb-3">
          Dados Bancários (Opcionais)
        </p>
        <p className="text-xs text-gray-500 mb-4">
          Se preenchidos, serão usados automaticamente nos contratos.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="bank"
              className="block text-sm font-medium text-text-secondary"
            >
              Banco
            </label>
            <input
              id="bank"
              type="text"
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              placeholder="Ex: Bradesco"
              className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm focus:outline-none focus:ring-brand-dark focus:border-brand-dark"
            />
          </div>

          <div>
            <label
              htmlFor="agency"
              className="block text-sm font-medium text-text-secondary"
            >
              Agência
            </label>
            <input
              id="agency"
              type="text"
              value={agency}
              onChange={(e) => setAgency(e.target.value)}
              placeholder="Ex: 1234"
              className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm focus:outline-none focus:ring-brand-dark focus:border-brand-dark"
            />
          </div>

          <div>
            <label
              htmlFor="checking_account"
              className="block text-sm font-medium text-text-secondary"
            >
              Conta Corrente
            </label>
            <input
              id="checking_account"
              type="text"
              value={checkingAccount}
              onChange={(e) => setCheckingAccount(e.target.value)}
              placeholder="Ex: 12345-6"
              className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm focus:outline-none focus:ring-brand-dark focus:border-brand-dark"
            />
          </div>
        </div>
      </div>

      {/* --- IDENTIDADE VISUAL (WHITELABEL) --- */}
      <div className="border-t pt-4 mt-4">
        <p className="text-sm font-medium text-text-secondary mb-1">
          Identidade Visual (Whitelabel)
        </p>
        <p className="text-xs text-gray-500 mb-4">
          As cores serão usadas para personalizar a visualização da plataforma
          para clientes deste escritório.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {colorIdentity.map((color, index) => {
            const inputId = `color_identity_${index}`;
            const isValid = /^#[0-9a-fA-F]{6}$/.test(color);
            return (
              <div key={inputId}>
                <label
                  htmlFor={inputId}
                  className="block text-sm font-medium text-text-secondary"
                >
                  {COLOR_LABELS[index]}
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    id={inputId}
                    type="color"
                    value={isValid ? color : "#000000"}
                    onChange={(e) => handleColorChange(index, e.target.value)}
                    aria-label={`Seletor de ${COLOR_LABELS[index]}`}
                    className="h-10 w-10 shrink-0 rounded-full border border-brand-border shadow-sm cursor-pointer p-0 bg-transparent appearance-none [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-full [&::-moz-color-swatch]:border-none [&::-moz-color-swatch]:rounded-full"
                  />
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => handleColorChange(index, e.target.value)}
                    maxLength={7}
                    placeholder="#RRGGBB"
                    aria-invalid={!isValid}
                    className={`min-w-0 flex-1 px-3 py-2 border rounded-md shadow-sm uppercase focus:outline-none focus:ring-2 ${
                      isValid
                        ? "border-brand-border focus:ring-brand-dark focus:border-brand-dark"
                        : "border-red-400 focus:ring-red-400 focus:border-red-400"
                    }`}
                  />
                </div>
                {!isValid && (
                  <p className="mt-1 text-xs text-red-500">
                    Formato inválido. Use #RRGGBB (ex.: #1A2B3C).
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        {/* --- CAMPO LOGO (UPLOAD DE FICHEIRO) --- */}
        <label
          htmlFor="logo"
          className="block text-sm font-medium text-text-secondary"
        >
          Logo
        </label>
        <div className="mt-1 flex items-center gap-3">
          {(() => {
            const previewSrc = logo
              ? URL.createObjectURL(logo)
              : resolveCompanyLogo(companyToEdit ?? null);
            return previewSrc ? (
              <img
                src={previewSrc}
                alt="Pré-visualização do logo"
                className="h-14 w-14 rounded-md object-contain border border-brand-border bg-white"
              />
            ) : (
              <div className="h-14 w-14 rounded-md border border-dashed border-brand-border bg-gray-50 flex items-center justify-center text-[10px] text-gray-400 text-center px-1">
                Sem logo
              </div>
            );
          })()}
          <input
            id="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setLogo(e.target.files[0]);
              }
            }}
            className="flex-1 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-brand-dark hover:file:bg-gray-200 cursor-pointer"
          />
        </div>
        <p className="mt-1 text-xs text-gray-500">
          PNG, JPEG, WebP ou SVG (≤2MB).
        </p>
      </div>

      {/* Exibe a mensagem de erro apenas se o estado 'error' tiver algum conteúdo. */}
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {/* --- BOTÃO DE SUBMISSÃO --- */}
      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Salvando..."
            : companyToEdit
              ? "Atualizar Escritório"
              : "Salvar Escritório"}
        </Button>
      </div>
    </form>
  );
}
