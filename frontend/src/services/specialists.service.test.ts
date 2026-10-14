import { afterEach, describe, expect, it, vi } from "vitest";
import api from "./api";
import * as specialistService from "./specialists.service";
import type {
  CreateSpecialistData,
  UpdateSpecialistData,
} from "./specialists.service";

vi.mock("./api", () => ({ default: { get: vi.fn() } }));

afterEach(() => vi.clearAllMocks());

describe("public specialist profile", () => {
  it("loads the raw public projection through its dedicated endpoint", async () => {
    const profile = {
      id: "specialist-1",
      name: "Ana",
      surname: "Silva",
      email: "ana@example.com",
      speciality: "CAR",
      calendly_url: null,
      calendly_scheduling_available: false,
    };
    vi.mocked(api.get).mockResolvedValue({ data: profile });
    const getProfile = specialistService.getPublicSpecialistById;
    await expect(getProfile(profile.id)).resolves.toEqual(profile);
    expect(api.get).toHaveBeenCalledWith(
      "/specialists/specialist-1/public-profile",
    );
  });
});

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

const updateWithNullCommission: UpdateSpecialistData = {
  // @ts-expect-error Edições não podem introduzir comissão nula.
  commission_rate: null,
};

describe("specialists service type contracts", () => {
  it("mantém comissão obrigatória na criação e opcional no update", () => {
    expect(createWithCommission.commission_rate).toBe(0);
    expect(partialUpdate.commission_rate).toBe(0);
    expect(createWithoutCommission).toBe(createBase);
    expect(updateWithNullCommission.commission_rate).toBeNull();
  });
});
