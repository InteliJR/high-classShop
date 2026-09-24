import { describe, expect, it } from "vitest";
import type {
  CreateSpecialistData,
  UpdateSpecialistData,
} from "./specialists.service";

const createBase = {
  name: "Ana",
  surname: "Silva",
  email: "ana@example.com",
  cnpj: "11222333000181",
  rg: "1234567",
  password_hash: "senha-segura",
  speciality: "CAR" as const,
};

const createWithCommission: CreateSpecialistData = {
  ...createBase,
  commission_rate: 0,
};

// @ts-expect-error POST /specialists exige comissão explícita.
const createWithoutCommission: CreateSpecialistData = createBase;

const partialUpdate: UpdateSpecialistData = { commission_rate: 0 };

// @ts-expect-error Edições não podem introduzir comissão nula.
const updateWithNullCommission: UpdateSpecialistData = { commission_rate: null };

describe("specialists service type contracts", () => {
  it("mantém comissão obrigatória na criação e opcional no update", () => {
    expect(createWithCommission.commission_rate).toBe(0);
    expect(partialUpdate.commission_rate).toBe(0);
    expect(createWithoutCommission).toBe(createBase);
    expect(updateWithNullCommission.commission_rate).toBeNull();
  });
});
