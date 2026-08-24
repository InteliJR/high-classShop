import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/patterns/PageHeader";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { CommissionSplitResult } from "../../components/commission/CommissionSplitResult";
import { computeNestedCommissionSplit } from "../../lib/commission-split";
import { normalizeCommissionCalculatorInput } from "../../lib/commission-calculator-input";
import {
  getSpecialists,
  type Specialist,
} from "../../services/specialists.service";
import { getCompanies, type Company } from "../../services/companies.service";
import { getCars } from "../../services/cars.service";
import { getBoats } from "../../services/boats.service";
import { getAircrafts } from "../../services/aircrafts.service";
import type { Product } from "../../types/types";
import { formatCurrency, type ProductCurrency } from "../../lib/currency";

type ProductCategory = "CAR" | "BOAT" | "AIRCRAFT";

const CATEGORY_LABEL: Record<ProductCategory, string> = {
  CAR: "Carro",
  BOAT: "Embarcação",
  AIRCRAFT: "Aeronave",
};

async function fetchProductsByCategory(
  category: ProductCategory,
): Promise<Product[]> {
  if (category === "CAR") return (await getCars(1, 100)).cars;
  if (category === "BOAT") return (await getBoats(1, 100)).boats;
  return (await getAircrafts(1, 100)).aircrafts;
}

const selectClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-focus-ring";
const labelClass = "block text-sm font-medium text-ink-soft mb-1";

export default function CommissionCalculatorPage() {
  const [saleValue, setSaleValue] = useState("0");
  const [saleCurrency, setSaleCurrency] = useState<ProductCurrency>("BRL");
  const [totalCommissionRate, setTotalCommissionRate] = useState("10");
  const [specialistShareRate, setSpecialistShareRate] = useState("0");
  const [officeShareRate, setOfficeShareRate] = useState("0");
  const [selectedSpecialistId, setSelectedSpecialistId] = useState("");
  const [selectedOfficeId, setSelectedOfficeId] = useState("");

  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [category, setCategory] = useState<ProductCategory | "">("");
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  useEffect(() => {
    getSpecialists().then(setSpecialists).catch(() => setSpecialists([]));
    getCompanies().then(setCompanies).catch(() => setCompanies([]));
  }, []);

  useEffect(() => {
    if (!category) {
      setProducts([]);
      setIsLoadingProducts(false);
      return;
    }

    let isCurrentRequest = true;
    setIsLoadingProducts(true);
    fetchProductsByCategory(category)
      .then((nextProducts) => {
        if (isCurrentRequest) setProducts(nextProducts);
      })
      .catch(() => {
        if (isCurrentRequest) setProducts([]);
      })
      .finally(() => {
        if (isCurrentRequest) setIsLoadingProducts(false);
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [category]);

  const calculationInput = useMemo(
    () =>
      normalizeCommissionCalculatorInput({
        saleValue,
        totalCommissionRate,
        specialistShareRate,
        officeShareRate,
      }),
    [saleValue, totalCommissionRate, specialistShareRate, officeShareRate],
  );

  const split = useMemo(
    () =>
      computeNestedCommissionSplit({
        proposalValue: calculationInput.saleValue,
        totalCommissionRate: calculationInput.totalCommissionRate,
        specialistShareRate: calculationInput.specialistShareRate,
        officeShareRate: calculationInput.officeShareRate,
      }),
    [calculationInput],
  );

  const sharesExceedTotal =
    calculationInput.specialistShareRate + calculationInput.officeShareRate >
    100;

  return (
    <div className="w-full">
      <PageHeader title="Calculadora de comissões" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-ink">Venda</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="calculator-category" className={labelClass}>
                  Categoria do produto (opcional)
                </label>
                <select
                  id="calculator-category"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value as ProductCategory | "");
                    setSelectedProductId("");
                    setProducts([]);
                    setSaleValue("0");
                    setSaleCurrency("BRL");
                  }}
                  className={selectClass}
                >
                  <option value="">Nenhuma — valor manual</option>
                  <option value="CAR">Carro</option>
                  <option value="BOAT">Embarcação</option>
                  <option value="AIRCRAFT">Aeronave</option>
                </select>
              </div>

              <div>
                <label htmlFor="calculator-product" className={labelClass}>
                  Produto {category && `(${CATEGORY_LABEL[category]})`}
                </label>
                <select
                  id="calculator-product"
                  disabled={!category || isLoadingProducts}
                  value={selectedProductId}
                  onChange={(e) => {
                    setSelectedProductId(e.target.value);
                    const product = products.find(
                      (p) => String(p.id) === e.target.value,
                    );
                    if (product) {
                      setSaleValue(String(product.valor));
                      setSaleCurrency(product.currency ?? "BRL");
                    }
                  }}
                  className={selectClass}
                >
                  <option value="">
                    {isLoadingProducts ? "Carregando..." : "Selecionar produto"}
                  </option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.marca} {p.modelo} — {formatCurrency(p.valor, p.currency)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="calculator-sale-value" className={labelClass}>
                Valor de venda ({saleCurrency === "USD" ? "US$" : "R$"})
              </label>
              <Input
                id="calculator-sale-value"
                type="number"
                min={0}
                step="0.01"
                value={saleValue}
                onChange={(e) => setSaleValue(e.target.value)}
              />
            </div>

            <div>
              <label
                htmlFor="calculator-total-commission-rate"
                className={labelClass}
              >
                Comissão total da venda (%)
              </label>
              <Input
                id="calculator-total-commission-rate"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={totalCommissionRate}
                onChange={(e) => setTotalCommissionRate(e.target.value)}
              />
            </div>
          </Card>

          <Card className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-ink">
              Especialista e escritório
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="calculator-specialist" className={labelClass}>
                  Especialista (opcional)
                </label>
                <select
                  id="calculator-specialist"
                  onChange={(e) => {
                    const specialistId = e.target.value;
                    const specialist = specialists.find(
                      (s) => s.id === specialistId,
                    );
                    setSelectedSpecialistId(specialistId);
                    setSpecialistShareRate(
                      String(specialist?.commission_rate ?? 0),
                    );
                  }}
                  value={selectedSpecialistId}
                  className={selectClass}
                >
                  <option value="">Nenhum — fatia manual</option>
                  {specialists.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.surname}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="calculator-specialist-share-rate"
                  className={labelClass}
                >
                  Fatia do especialista sobre o bolo (%)
                </label>
                <Input
                  id="calculator-specialist-share-rate"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={specialistShareRate}
                  onChange={(e) => setSpecialistShareRate(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="calculator-office" className={labelClass}>
                  Escritório (opcional)
                </label>
                <select
                  id="calculator-office"
                  onChange={(e) => {
                    const companyId = e.target.value;
                    const company = companies.find((c) => c.id === companyId);
                    setSelectedOfficeId(companyId);
                    setOfficeShareRate(String(company?.commission_rate ?? 0));
                  }}
                  value={selectedOfficeId}
                  className={selectClass}
                >
                  <option value="">Nenhum</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="calculator-office-share-rate"
                  className={labelClass}
                >
                  Fatia do escritório sobre a comissão total (%)
                </label>
                <Input
                  id="calculator-office-share-rate"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={officeShareRate}
                  onChange={(e) => setOfficeShareRate(e.target.value)}
                />
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:sticky lg:top-6 h-fit">
          <Card>
            <h2 className="text-lg font-semibold text-ink mb-4">Resultado</h2>
            {sharesExceedTotal ? (
              <p className="text-sm text-red-600">
                As fatias do especialista e do escritório não podem ultrapassar
                100% da comissão total.
              </p>
            ) : (
              <CommissionSplitResult
                saleValue={calculationInput.saleValue}
                split={split}
                currency={saleCurrency}
              />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
