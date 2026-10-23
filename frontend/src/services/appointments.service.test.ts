import { afterEach, describe, expect, it, vi } from "vitest";
import api from "./api";
import { checkExistingAppointment, createPendingAppointment, createConsultancyAppointment } from "./appointments.service";
import * as service from "./appointments.service";
import type { ProductPendingAppointmentInput } from "./appointments.service";

vi.mock("./api", () => ({ default: { get: vi.fn(), post: vi.fn() } }));
afterEach(() => vi.resetAllMocks());

const base = {
  client_id: "customer-1", specialist_id: "specialist-1", product_type: "CAR" as const, product_id: "car-1",
};
const snapshot = {
  appointment_id: "appointment-1", process_id: "process-1", appointment_status: "PENDING" as const,
  scheduling_method: "EMAIL" as const, appointment_datetime: "2099-10-20T17:30:00.000Z",
  specialist_contact_email: "private-specialist@example.com",
};

describe("owned existing appointment check", () => {
  it.each([{ exists: false }, { exists: true, ...snapshot }])("returns the discriminated result without sending client identity", async (result) => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, message: "Consulta realizada com sucesso", data: result } });
    await expect(checkExistingAppointment("specialist-1", "CAR", "car-1")).resolves.toEqual(result);
    expect(api.get).toHaveBeenCalledWith("/appointments/check", {
      withCredentials: true,
      params: { specialist_id: "specialist-1", product_type: "CAR", product_id: "car-1" },
    });
  });

  it("propagates API failures so failed checks cannot become false negatives", async () => {
    const error = new Error("Sessão expirada");
    vi.mocked(api.get).mockRejectedValue(error);
    await expect(checkExistingAppointment("specialist-1", "CAR", "car-1")).rejects.toBe(error);
  });
});

describe("pending product request contracts", () => {
  it("sends a dated EMAIL proposal and returns its process ID", async () => {
    const input: ProductPendingAppointmentInput = { ...base, scheduling_method: "EMAIL", appointment_datetime: snapshot.appointment_datetime };
    const created = { ...base, id: snapshot.appointment_id, process_id: snapshot.process_id, status: "PENDING" as const, appointment_datetime: snapshot.appointment_datetime, scheduling_method: "EMAIL" as const, specialist_contact_email: snapshot.specialist_contact_email, created_at: "2026-10-14T12:00:00Z", updated_at: "2026-10-14T12:00:00Z" };
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, data: created } });
    await expect(createPendingAppointment(input)).resolves.toEqual(created);
    expect(api.post).toHaveBeenCalledWith("/appointments/pending", input, { withCredentials: true });
  });

  it.each([undefined, "", "invalid", "2000-01-01T00:00:00.000Z", "2099-10-20T17:30", "2099-02-30T17:30:00Z", "2099-01-01T24:00:00Z"])("rejects EMAIL with absent/invalid/past/non-ISO datetime %j before HTTP", async (appointment_datetime) => {
    // Simulates untyped callers crossing the runtime boundary.
    await expect(createPendingAppointment({ ...base, scheduling_method: "EMAIL", appointment_datetime } as ProductPendingAppointmentInput)).rejects.toThrow();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("rejects client datetime on a CALENDLY request at runtime", async () => {
    const input = { ...base, scheduling_method: "CALENDLY", appointment_datetime: snapshot.appointment_datetime };
    await expect(createPendingAppointment(input as unknown as ProductPendingAppointmentInput)).rejects.toThrow();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("preserves CALENDLY product creation without datetime", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: "appointment-1", process_id: "process-1" } } });
    await createPendingAppointment({ ...base, scheduling_method: "CALENDLY" });
    expect(api.post).toHaveBeenCalledWith("/appointments/pending", { ...base, scheduling_method: "CALENDLY" }, { withCredentials: true });
  });

  it("preserves consultancy EMAIL without datetime", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { data: { id: "appointment-1" } } });
    await createConsultancyAppointment({ client_id: base.client_id, specialist_id: base.specialist_id, scheduling_method: "EMAIL" });
    expect(api.post).toHaveBeenCalledWith("/appointments/pending", { client_id: base.client_id, specialist_id: base.specialist_id, scheduling_method: "EMAIL" }, { withCredentials: true });
  });
});

describe("duplicate recovery", () => {
  it.each([
    snapshot,
    {
      appointment_id: null,
      process_id: snapshot.process_id,
      appointment_status: null,
      scheduling_method: null,
      appointment_datetime: null,
    },
  ])("reads only the owned snapshot at error.details.existing_request", (existing_request) => {
    expect(service.getActiveProcessSnapshot({ response: { status: 409, data: { error: { code: "ACTIVE_PROCESS_EXISTS", details: { existing_request } } } } })).toEqual(existing_request);
  });

  it("preserves the owner-scoped specialist contact from an EMAIL duplicate", () => {
    expect(
      service.getActiveProcessSnapshot({
        response: {
          status: 409,
          data: {
            error: {
              code: "ACTIVE_PROCESS_EXISTS",
              details: { existing_request: snapshot },
            },
          },
        },
      }),
    ).toMatchObject({
      specialist_contact_email: snapshot.specialist_contact_email,
    });
  });

  it("drops a contact field from non-EMAIL duplicate payloads", () => {
    const calendlySnapshot = {
      ...snapshot,
      scheduling_method: "CALENDLY",
    };
    expect(
      service.getActiveProcessSnapshot({
        response: {
          status: 409,
          data: {
            error: {
              code: "ACTIVE_PROCESS_EXISTS",
              details: { existing_request: calendlySnapshot },
            },
          },
        },
      }),
    ).not.toHaveProperty("specialist_contact_email");
  });

  it.each([
    { response: { status: 409, data: { message: "Conflito" } } },
    { response: { status: 409, data: { error: { code: "CALENDLY_UNAVAILABLE", details: { existing_request: snapshot } } } } },
    { response: { status: 400, data: { error: { code: "ACTIVE_PROCESS_EXISTS", details: { existing_request: snapshot } } } } },
    { response: { status: 409, data: { code: "ACTIVE_PROCESS_EXISTS", existing_request: snapshot } } },
    { response: { status: 409, data: { error: { code: "ACTIVE_PROCESS_EXISTS", details: { existing_request: { appointment_id: "a" } } } } } },
    null,
  ])("leaves ordinary errors and malformed duplicate payloads unrecovered", (error) => {
    expect(service.getActiveProcessSnapshot(error)).toBeNull();
  });
});

// Compile-time boundary: the product union requires EMAIL datetime and forbids CALENDLY datetime.
const emailInput: ProductPendingAppointmentInput = { ...base, scheduling_method: "EMAIL", appointment_datetime: snapshot.appointment_datetime };
const calendlyInput: ProductPendingAppointmentInput = { ...base, scheduling_method: "CALENDLY" };
// @ts-expect-error EMAIL product proposals require a datetime.
const missingEmailDatetime: ProductPendingAppointmentInput = { ...base, scheduling_method: "EMAIL" };
// @ts-expect-error CALENDLY datetime is supplied by synchronized callbacks only.
const clientCalendlyDatetime: ProductPendingAppointmentInput = { ...base, scheduling_method: "CALENDLY", appointment_datetime: snapshot.appointment_datetime };
void [emailInput, calendlyInput, missingEmailDatetime, clientCalendlyDatetime];
