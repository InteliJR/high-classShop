// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkExistingAppointment } from "../services/appointments.service";
import type { ExistingAppointmentCheck } from "../services/appointments.service";
import { useCheckAppointment } from "./useCheckAppointment";
import { StrictMode, useLayoutEffect } from "react";
import { useAuth } from "../store/authStateManager";

const customer = { id: "customer-1", name: "João", surname: "Silva", email: "joao@example.com", cpf: "", rg: "", role: "CUSTOMER" as const };

vi.mock("../services/appointments.service", () => ({ checkExistingAppointment: vi.fn() }));

const found: ExistingAppointmentCheck = {
  exists: true, appointment_id: "appointment-1", process_id: "process-1", appointment_status: "PENDING",
  scheduling_method: "EMAIL", appointment_datetime: "2099-10-20T17:30:00.000Z",
  process: { id: "process-1", status: "SCHEDULING", is_active: true, status_history: [] },
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

beforeEach(() => { useAuth.setState({ user: customer }); vi.useFakeTimers(); vi.mocked(checkExistingAppointment).mockResolvedValue({ exists: false, process: null }); });
afterEach(() => { cleanup(); useAuth.setState({ user: null }); vi.useRealTimers(); vi.resetAllMocks(); });

describe("owned appointment check hook", () => {
  const initialScope = { specialistId: "specialist-1", productType: "CAR" as "CAR" | "BOAT" | "AIRCRAFT", productId: "car-1" as string | undefined };
  const scopeChanges = [
    { name: "customer identity", user: { ...customer, id: "customer-2" }, params: initialScope, loading: true },
    { name: "role", user: { ...customer, role: "SPECIALIST" as const }, params: initialScope, loading: false },
    { name: "missing identity", user: null, params: initialScope, loading: false },
    { name: "specialist", user: customer, params: { ...initialScope, specialistId: "specialist-2" }, loading: true },
    { name: "product type", user: customer, params: { ...initialScope, productType: "BOAT" as const }, loading: true },
    { name: "product ID", user: customer, params: { ...initialScope, productId: "car-2" }, loading: true },
    { name: "missing product", user: customer, params: { ...initialScope, productId: undefined }, loading: false },
  ];

  describe.each([false, true])("render isolation with StrictMode=%s", (strict) => {
    it("reports an eligible initial render as loading before effects", () => {
      const renders: ReturnType<typeof useCheckAppointment>[] = [];
      const commits: ReturnType<typeof useCheckAppointment>[] = [];
      renderHook(() => {
        const value = useCheckAppointment("specialist-1", "CAR", "car-1");
        renders.push({ ...value });
        useLayoutEffect(() => { commits.push({ ...value }); });
        return value;
      }, { wrapper: strict ? StrictMode : undefined });
      const unchecked = { existingAppointment: null, isLoading: true, error: null };
      expect(commits).toEqual(commits.map(() => unchecked));
      expect(renders).toEqual(renders.map(() => unchecked));
    });

    it.each(scopeChanges.flatMap((change) => [
      { ...change, previous: found, resultName: "snapshot" },
      { ...change, previous: { exists: false, process: null } as ExistingAppointmentCheck, resultName: "verified absence" },
    ]))("hides $resultName before effects on a change of $name", async ({ user, params, loading, previous }) => {
      vi.mocked(checkExistingAppointment).mockResolvedValueOnce(previous);
      const renders: ReturnType<typeof useCheckAppointment>[] = [];
      const commits: ReturnType<typeof useCheckAppointment>[] = [];
      const { result, rerender } = renderHook((scope) => {
        const value = useCheckAppointment(scope.specialistId, scope.productType, scope.productId);
        renders.push({ ...value });
        // Layout effects observe the committed value before the hook's passive reset.
        useLayoutEffect(() => { commits.push({ ...value }); });
        return value;
      }, { initialProps: initialScope, wrapper: strict ? StrictMode : undefined });
      await advance();
      expect(result.current).toEqual({ existingAppointment: previous, isLoading: false, error: null });
      renders.length = 0;
      commits.length = 0;

      act(() => { useAuth.setState({ user }); rerender(params); });

      expect(renders.length).toBeGreaterThan(0);
      expect(commits.length).toBeGreaterThan(0);
      const unchecked = { existingAppointment: null, isLoading: loading, error: null };
      expect(commits).toEqual(commits.map(() => unchecked));
      expect(renders).toEqual(renders.map(() => unchecked));
    });

    it("hides a former customer's error from the first new commit", async () => {
      vi.mocked(checkExistingAppointment).mockRejectedValueOnce(new Error("Former customer error"));
      const commits: ReturnType<typeof useCheckAppointment>[] = [];
      const { result } = renderHook(() => {
        const value = useCheckAppointment("specialist-1", "CAR", "car-1");
        useLayoutEffect(() => { commits.push({ ...value }); });
        return value;
      }, { wrapper: strict ? StrictMode : undefined });
      await advance();
      expect(result.current.error).toBe("Former customer error");
      commits.length = 0;
      act(() => { useAuth.setState({ user: { ...customer, id: "customer-2" } }); });
      const unchecked = { existingAppointment: null, isLoading: true, error: null };
      expect(commits).toEqual(commits.map(() => unchecked));
    });

    it.each([
      { name: "snapshot", value: found },
      { name: "verified absence", value: { exists: false, process: null } as ExistingAppointmentCheck },
      { name: "rejection", value: null },
    ])("discards a stale $name across an account switch in every commit", async ({ value }) => {
      const earlier = deferred();
      const latest = deferred();
      vi.mocked(checkExistingAppointment).mockReturnValueOnce(earlier.promise).mockReturnValueOnce(latest.promise);
      const renders: ReturnType<typeof useCheckAppointment>[] = [];
      const commits: ReturnType<typeof useCheckAppointment>[] = [];
      const { result } = renderHook(() => {
        const state = useCheckAppointment("specialist-1", "CAR", "car-1");
        renders.push({ ...state });
        useLayoutEffect(() => { commits.push({ ...state }); });
        return state;
      }, { wrapper: strict ? StrictMode : undefined });
      await advance();
      renders.length = 0;
      commits.length = 0;
      act(() => { useAuth.setState({ user: { ...customer, id: "customer-2" } }); });
      await advance();
      await act(async () => { if (value) earlier.resolve(value); else earlier.reject(new Error("obsolete")); });
      const unchecked = { existingAppointment: null, isLoading: true, error: null };
      expect(commits).toEqual(commits.map(() => unchecked));
      expect(renders).toEqual(renders.map(() => unchecked));
      expect(result.current).toEqual(unchecked);
      await act(async () => { latest.resolve(found); });
      expect(result.current).toEqual({ existingAppointment: found, isLoading: false, error: null });
    });

    it.each(scopeChanges.filter((change) => !change.loading).flatMap((change) => [
      { ...change, outcome: "resolve" as const },
      { ...change, outcome: "reject" as const },
    ]))("stays unchecked after $name with an obsolete request that later $outcome", async ({ user, params, outcome }) => {
      const pending = deferred();
      vi.mocked(checkExistingAppointment).mockReturnValueOnce(pending.promise);
      const commits: ReturnType<typeof useCheckAppointment>[] = [];
      const { result, rerender } = renderHook((scope) => {
        const value = useCheckAppointment(scope.specialistId, scope.productType, scope.productId);
        useLayoutEffect(() => { commits.push({ ...value }); });
        return value;
      }, { initialProps: initialScope, wrapper: strict ? StrictMode : undefined });
      await advance();
      commits.length = 0;
      act(() => { useAuth.setState({ user }); rerender(params); });
      await act(async () => { if (outcome === "resolve") pending.resolve(found); else pending.reject(new Error("obsolete")); });
      const unchecked = { existingAppointment: null, isLoading: false, error: null };
      expect(commits).toEqual(commits.map(() => unchecked));
      expect(result.current).toEqual(unchecked);
      expect(checkExistingAppointment).toHaveBeenCalledTimes(1);
    });
  });

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

  it("refetches silently when the tab becomes visible, keeping the last result", async () => {
    const advanced: ExistingAppointmentCheck = {
      ...found, appointment_id: null, appointment_status: null, scheduling_method: null, appointment_datetime: null,
      process: { id: "process-1", status: "NEGOTIATION", is_active: true, status_history: [] },
    };
    vi.mocked(checkExistingAppointment).mockResolvedValueOnce(found).mockResolvedValueOnce(advanced);
    const { result } = renderHook(() => useCheckAppointment("specialist-1", "CAR", "car-1"));
    await advance();
    expect(result.current.existingAppointment).toEqual(found);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(result.current).toEqual({ existingAppointment: found, isLoading: false, error: null });
    await advance();
    expect(checkExistingAppointment).toHaveBeenCalledTimes(2);
    expect(result.current).toEqual({ existingAppointment: advanced, isLoading: false, error: null });
  });

  it("keeps the last result when a focus refetch fails", async () => {
    vi.mocked(checkExistingAppointment).mockResolvedValueOnce(found).mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useCheckAppointment("specialist-1", "CAR", "car-1"));
    await advance();
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    await advance();
    expect(checkExistingAppointment).toHaveBeenCalledTimes(2);
    expect(result.current).toEqual({ existingAppointment: found, isLoading: false, error: null });
  });

  it("exposes exists:false as a discriminated successful result", async () => {
    const { result } = renderHook(() => useCheckAppointment("specialist-1", "CAR", "car-1"));
    await advance();
    expect(result.current.existingAppointment).toEqual({ exists: false, process: null });
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
    expect(result.current.existingAppointment).toEqual({ exists: false, process: null });
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
    await act(async () => { latest.resolve({ exists: false, process: null }); });
    expect(result.current).toEqual({ existingAppointment: { exists: false, process: null }, isLoading: false, error: null });
  });

  it("does not let an earlier success replace the latest result", async () => {
    const earlier = deferred();
    vi.mocked(checkExistingAppointment).mockReturnValueOnce(earlier.promise).mockResolvedValueOnce({ exists: false, process: null });
    const { result, rerender } = renderHook(({ productId }) => useCheckAppointment("specialist-1", "CAR", productId), { initialProps: { productId: "car-1" } });
    await advance();
    rerender({ productId: "car-2" });
    await advance();
    await act(async () => { earlier.resolve(found); });
    expect(result.current).toEqual({ existingAppointment: { exists: false, process: null }, isLoading: false, error: null });
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
    expect(result.current).toEqual({ existingAppointment: { exists: false, process: null }, isLoading: false, error: null });
  });

  it("invalidates a former customer's in-flight response on account switch", async () => {
    const earlier = deferred();
    vi.mocked(checkExistingAppointment).mockReturnValueOnce(earlier.promise).mockResolvedValueOnce({ exists: false, process: null });
    const { result } = renderHook(() => useCheckAppointment("specialist-1", "CAR", "car-1"));
    await advance();
    act(() => { useAuth.setState({ user: { ...customer, id: "customer-2" } }); });
    expect(result.current).toEqual({ existingAppointment: null, isLoading: true, error: null });
    await act(async () => { earlier.resolve(found); });
    expect(result.current.existingAppointment).toBeNull();
    await advance();
    expect(checkExistingAppointment).toHaveBeenCalledTimes(2);
    expect(result.current.existingAppointment).toEqual({ exists: false, process: null });
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
