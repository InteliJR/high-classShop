import { describe, it, expect } from "vitest";
import { groupClientsByConsultant } from "./group-clients-by-consultant";
import type { OfficeClient } from "../services/office";

function makeClient(overrides: Partial<OfficeClient>): OfficeClient {
  return {
    id: "c1",
    name: "Cliente",
    surname: "Um",
    email: "cliente@ex.com",
    cpf: "00000000000",
    civil_state: null,
    consultant_id: null,
    consultant: null,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("groupClientsByConsultant", () => {
  it("agrupa clientes por consultor e ordena os grupos por nome", () => {
    const clients: OfficeClient[] = [
      makeClient({
        id: "1",
        consultant_id: "cons-b",
        consultant: { id: "cons-b", name: "Bruno", surname: "Silva" },
      }),
      makeClient({
        id: "2",
        consultant_id: "cons-a",
        consultant: { id: "cons-a", name: "Ana", surname: "Costa" },
      }),
      makeClient({
        id: "3",
        consultant_id: "cons-a",
        consultant: { id: "cons-a", name: "Ana", surname: "Costa" },
      }),
    ];

    const result = groupClientsByConsultant(clients);

    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].consultantName).toBe("Ana Costa");
    expect(result.groups[0].clients.map((c) => c.id)).toEqual(["2", "3"]);
    expect(result.groups[1].consultantName).toBe("Bruno Silva");
    expect(result.withoutConsultant).toHaveLength(0);
  });

  it("separa clientes sem consultor (cadastro whitelabel) em withoutConsultant", () => {
    const clients: OfficeClient[] = [
      makeClient({ id: "1", consultant_id: null, consultant: null }),
      makeClient({
        id: "2",
        consultant_id: "cons-a",
        consultant: { id: "cons-a", name: "Ana", surname: "Costa" },
      }),
    ];

    const result = groupClientsByConsultant(clients);

    expect(result.groups).toHaveLength(1);
    expect(result.withoutConsultant.map((c) => c.id)).toEqual(["1"]);
  });

  it("lista vazia retorna grupos e withoutConsultant vazios", () => {
    const result = groupClientsByConsultant([]);
    expect(result.groups).toEqual([]);
    expect(result.withoutConsultant).toEqual([]);
  });
});
