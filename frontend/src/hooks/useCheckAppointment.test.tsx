// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkExistingAppointment } from "../services/appointments.service";
import type { ExistingAppointmentCheck } from "../services/appointments.service";
import { useCheckAppointment } from "./useCheckAppointment";
import { StrictMode } from "react";
import { useAuth } from "../store/authStateManager";

const customer = { id: "customer-1", name: "João", surname: "Silva", email: "joao@example.com", cpf: "", rg: "", role: "CUSTOMER" as const };

vi.mock("../services/appointments.service", () => ({ checkExistingAppointment: vi.fn() }));

const found: ExistingAppointmentCheck = {
  exists: true, appointment_id: "appointment-1", process_id: "process-1", appointment_status: "PENDING",
  scheduling_method: "EMAIL", appointment_datetime: "2099-10-20T17:30:00.000Z",
};

function deferred() {
  let resolve!: (value: ExistingAppointmentCheck) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<ExistingAppointmentCheck>((res, rej) => { resolve = res; reject = rej; });
  // Old implementations may never attach a handler; keep the RED focused on state assertions.
  void promise.catch(() => {});
  return { promise, resolve, reject };
}

async function advance(ms = 500) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

beforeEach(() => { useAuth.setState({ user: customer }); vi.useFakeTimers(); vi.mocked(checkExistingAppointment).mockResolvedValue({ exists: false }); });
afterEach(() => { cleanup(); useAuth.setState({ user: null }); vi.useRealTimers(); vi.resetAllMocks(); });

describe("owned appointment check hook", () => {
  it("debounces for 500ms and calls the own-only three-argument service", async () => {
    vi.mocked(checkExistingAppointment).mockResolvedValue(found);
    const { result } = renderHook(() => useCheckAppointment("specialist-1", "CAR", "car-1"));
    expect(result.current).toEqual({ existingAppointment: null, isLoading: true, error: null });
    await advance(499);
    expect(checkExistingAppointment).not.toHaveBeenCalled();
    await advance(1);
    expect(checkExistingAppointment).toHaveBeenCalledWith("specialist-1", "CAR", "car-1");
    expect(result.current).toEqual({ existingAppointment: found, isLoading: false, error: null });
  });

  it("exposes exists:false as a discriminated successful result", async () => {
    const { result } = renderHook(() => useCheckAppointment("specialist-1", "CAR", "car-1"));
    await advance();
    expect(result.current.existingAppointment).toEqual({ exists: false });
    expect(result.current.error).toBeNull();
  });

  it.each([
    [undefined, "CAR", "car-1"], ["specialist-1", undefined, "car-1"], ["specialist-1", "CAR", undefined],
  ] as const)("does not check missing parameters %j", async (specialistId, productType, productId) => {
    const { result } = renderHook(() => useCheckAppointment(specialistId, productType, productId));
    await advance();
    expect(checkExistingAppointment).not.toHaveBeenCalled();
    expect(result.current).toEqual({ existingAppointment: null, isLoading: false, error: null });
  });

  it("resets the debounce when the product changes", async () => {
    const { rerender } = renderHook(({ productId }) => useCheckAppointment("specialist-1", "CAR", productId), { initialProps: { productId: "car-1" } });
    await advance(400);
    rerender({ productId: "car-2" });
    await advance(100);
    expect(checkExistingAppointment).not.toHaveBeenCalled();
    await advance(400);
    expect(checkExistingAppointment).toHaveBeenCalledExactlyOnceWith("specialist-1", "CAR", "car-2");
  });

  it("exposes the service error and clears it immediately for a new request", async () => {
    vi.mocked(checkExistingAppointment).mockRejectedValueOnce(new Error("Sessão expirada"));
    const { result, rerender } = renderHook(({ productId }) => useCheckAppointment("specialist-1", "CAR", productId), { initialProps: { productId: "car-1" } });
    await advance();
    expect(result.current).toEqual({ existingAppointment: null, isLoading: false, error: "Sessão expirada" });
    rerender({ productId: "car-2" });
    expect(result.current).toEqual({ existingAppointment: null, isLoading: true, error: null });
    await advance();
    expect(result.current.existingAppointment).toEqual({ exists: false });
  });

  it("uses a readable fallback for a non-Error rejection", async () => {
    vi.mocked(checkExistingAppointment).mockRejectedValueOnce({ status: 401 });
    const { result } = renderHook(() => useCheckAppointment("specialist-1", "CAR", "car-1"));
    await advance();
    expect(result.current.error).toBe("Erro ao verificar agendamentos");
  });

  it.each(["resolve", "reject"] as const)("ignores an earlier %s while the new request is loading", async (outcome) => {
    const earlier = deferred();
    const latest = deferred();
    vi.mocked(checkExistingAppointment).mockReturnValueOnce(earlier.promise).mockReturnValueOnce(latest.promise);
    const { result, rerender } = renderHook(({ productId }) => useCheckAppointment("specialist-1", "CAR", productId), { initialProps: { productId: "car-1" } });
    await advance();
    rerender({ productId: "car-2" });
    await advance();
    await act(async () => { if (outcome === "resolve") earlier.resolve(found); else earlier.reject(new Error("obsolete")); });
    expect(result.current).toEqual({ existingAppointment: null, isLoading: true, error: null });
    await act(async () => { latest.resolve({ exists: false }); });
    expect(result.current).toEqual({ existingAppointment: { exists: false }, isLoading: false, error: null });
  });

  it("does not let an earlier success replace the latest result", async () => {
    const earlier = deferred();
    vi.mocked(checkExistingAppointment).mockReturnValueOnce(earlier.promise).mockResolvedValueOnce({ exists: false });
    const { result, rerender } = renderHook(({ productId }) => useCheckAppointment("specialist-1", "CAR", productId), { initialProps: { productId: "car-1" } });
    await advance();
    rerender({ productId: "car-2" });
    await advance();
    await act(async () => { earlier.resolve(found); });
    expect(result.current).toEqual({ existingAppointment: { exists: false }, isLoading: false, error: null });
  });

  it("invalidates an in-flight response when parameters become missing", async () => {
    const pending = deferred();
    vi.mocked(checkExistingAppointment).mockReturnValueOnce(pending.promise);
    const { result, rerender } = renderHook(({ productId }) => useCheckAppointment("specialist-1", "CAR", productId), { initialProps: { productId: "car-1" as string | undefined } });
    await advance();
    rerender({ productId: undefined });
    await act(async () => { pending.resolve(found); });
    expect(result.current).toEqual({ existingAppointment: null, isLoading: false, error: null });
  });

  it("cleans up a pending debounce on unmount", async () => {
    const { unmount } = renderHook(() => useCheckAppointment("specialist-1", "CAR", "car-1"));
    unmount();
    await advance();
    expect(checkExistingAppointment).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores completion after unmount", async () => {
    const pending = deferred();
    vi.mocked(checkExistingAppointment).mockReturnValueOnce(pending.promise);
    const { result, unmount } = renderHook(() => useCheckAppointment("specialist-1", "CAR", "car-1"));
    await advance();
    const state = result.current;
    unmount();
    await act(async () => { pending.resolve(found); });
    expect(result.current).toBe(state);
  });

  it("survives StrictMode cleanup with exactly one current check", async () => {
    const { result } = renderHook(() => useCheckAppointment("specialist-1", "CAR", "car-1"), { wrapper: StrictMode });
    await advance();
    expect(checkExistingAppointment).toHaveBeenCalledExactlyOnceWith("specialist-1", "CAR", "car-1");
    expect(result.current).toEqual({ existingAppointment: { exists: false }, isLoading: false, error: null });
  });

  it("invalidates a former customer's in-flight response on account switch", async () => {
    const earlier = deferred();
    vi.mocked(checkExistingAppointment).mockReturnValueOnce(earlier.promise).mockResolvedValueOnce({ exists: false });
    const { result } = renderHook(() => useCheckAppointment("specialist-1", "CAR", "car-1"));
    await advance();
    act(() => { useAuth.setState({ user: { ...customer, id: "customer-2" } }); });
    expect(result.current).toEqual({ existingAppointment: null, isLoading: true, error: null });
    await act(async () => { earlier.resolve(found); });
    expect(result.current.existingAppointment).toBeNull();
    await advance();
    expect(checkExistingAppointment).toHaveBeenCalledTimes(2);
    expect(result.current.existingAppointment).toEqual({ exists: false });
  });

  it.each([null, { ...customer, role: "SPECIALIST" as const }])("does not check for a missing or non-customer identity", async (user) => {
    useAuth.setState({ user });
    const { result } = renderHook(() => useCheckAppointment("specialist-1", "CAR", "car-1"));
    await advance();
    expect(checkExistingAppointment).not.toHaveBeenCalled();
    expect(result.current).toEqual({ existingAppointment: null, isLoading: false, error: null });
  });

  it("clears the owned snapshot when the authenticated role changes", async () => {
    vi.mocked(checkExistingAppointment).mockResolvedValueOnce(found);
    const { result } = renderHook(() => useCheckAppointment("specialist-1", "CAR", "car-1"));
    await advance();
    expect(result.current.existingAppointment).toEqual(found);
    act(() => { useAuth.setState({ user: { ...customer, role: "SPECIALIST" } }); });
    expect(result.current).toEqual({ existingAppointment: null, isLoading: false, error: null });
  });
});
