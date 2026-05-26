import { useEffect, useState } from "react";
import { getSpecialistsGroupedByCategory, type Specialist } from "../../services/specialists.service";
import { createConsultantProcess, type Client } from "../../services/consultant.service";
import { getCars } from "../../services/cars.service";
import { getBoats } from "../../services/boats.service";
import { getAircrafts } from "../../services/aircrafts.service";
import Button from "../../components/ui/button";

type ProductType = "CAR" | "BOAT" | "AIRCRAFT";

const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  CAR: "Carros",
  BOAT: "Embarcações",
  AIRCRAFT: "Aeronaves",
};

type ProductOption = { id: number; label: string };

interface Props {
  client: Client;
  onSuccess: () => void;
  onClose: () => void;
}

async function fetchProductOptions(type: ProductType): Promise<ProductOption[]> {
  try {
    if (type === "CAR") {
      const res = await getCars(1, 50);
      return res.cars.map((c) => ({ id: c.id, label: `${c.marca} ${c.modelo ?? ""} (${c.ano ?? "—"})`.trim() }));
    }
    if (type === "BOAT") {
      const res = await getBoats(1, 50);
      return res.boats.map((b) => ({ id: b.id, label: `${b.marca} ${b.modelo ?? ""} (${b.ano ?? "—"})`.trim() }));
    }
    // AIRCRAFT
    const res = await getAircrafts(1, 50);
    return res.aircrafts.map((a) => ({ id: a.id, label: `${a.marca} ${a.modelo ?? ""} (${a.ano ?? "—"})`.trim() }));
  } catch {
    return [];
  }
}

export default function CreateConsultantProcessModal({ client, onSuccess, onClose }: Props) {
  const [productType, setProductType] = useState<ProductType>("CAR");
  const [specialistId, setSpecialistId] = useState("");
  const [productId, setProductId] = useState<number | "">("");
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [isLoadingSpecialists, setIsLoadingSpecialists] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoadingSpecialists(true);
    setSpecialistId("");
    getSpecialistsGroupedByCategory()
      .then((grouped) => setSpecialists(grouped[productType] ?? []))
      .catch(() => setSpecialists([]))
      .finally(() => setIsLoadingSpecialists(false));
  }, [productType]);

  useEffect(() => {
    setIsLoadingProducts(true);
    setProductId("");
    fetchProductOptions(productType)
      .then(setProducts)
      .finally(() => setIsLoadingProducts(false));
  }, [productType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!specialistId) {
      setError("Selecione um especialista.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createConsultantProcess({
        client_id: client.id,
        specialist_id: specialistId,
        product_type: productType,
        product_id: productId !== "" ? productId : undefined,
      });
      onSuccess();
    } catch (err) {
      setError((err as Error).message || "Erro ao criar processo. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <h2 className="h2-style">Criar Processo</h2>
      <p className="text-sm text-gray-500">
        Cliente: <strong>{client.name} {client.surname}</strong>
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tipo de produto
          </label>
          <select
            value={productType}
            onChange={(e) => setProductType(e.target.value as ProductType)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            {(Object.keys(PRODUCT_TYPE_LABELS) as ProductType[]).map((t) => (
              <option key={t} value={t}>{PRODUCT_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Produto (opcional)
          </label>
          {isLoadingProducts ? (
            <p className="text-sm text-gray-400">Carregando produtos...</p>
          ) : products.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum produto cadastrado para {PRODUCT_TYPE_LABELS[productType]}.</p>
          ) : (
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value === "" ? "" : Number(e.target.value))}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Sem produto específico (consultoria geral)</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          )}
          <p className="text-xs text-gray-400 mt-1">
            Se não souber o produto agora, o especialista pode selecionar depois.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Especialista
          </label>
          {isLoadingSpecialists ? (
            <p className="text-sm text-gray-400">Carregando especialistas...</p>
          ) : specialists.length === 0 ? (
            <p className="text-sm text-red-500">Nenhum especialista disponível para {PRODUCT_TYPE_LABELS[productType]}.</p>
          ) : (
            <select
              value={specialistId}
              onChange={(e) => setSpecialistId(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            >
              <option value="">Selecione um especialista</option>
              {specialists.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.surname}
                </option>
              ))}
            </select>
          )}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || isLoadingSpecialists}>
            {isSubmitting ? "Criando..." : "Criar Processo"}
          </Button>
        </div>
      </form>
    </div>
  );
}
