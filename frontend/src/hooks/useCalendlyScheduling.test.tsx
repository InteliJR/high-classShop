// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCalendlyEventListener,
  type EventScheduledEvent,
} from "react-calendly";
import {
  getCalendlySyncStatus,
  registerCalendlyScheduledEvent,
} from "../services/appointments.service";
import { useCalendlyScheduling } from "./useCalendlyScheduling";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => navigate,
}));
vi.mock("react-calendly", () => ({ useCalendlyEventListener: vi.fn() }));
vi.mock("../services/appointments.service", () => ({
  cancelPendingAppointment: vi.fn(),
  getCalendlySyncStatus: vi.fn(),
  registerCalendlyScheduledEvent: vi.fn(),
}));

const payload = {
  event_uri: "https://api.calendly.com/scheduled_events/event-1",
  invitee_uri:
    "https://api.calendly.com/scheduled_events/event-1/invitees/invitee-1",
};
const pendingStatus = {
  appointment_id: "appointment-1",
  status: "PENDING" as const,
  calendly_sync_status: "PENDING" as const,
  appointment_datetime: null,
  calendly_last_sync_at: null,
};
const syncedStatus = {
  ...pendingStatus,
  status: "SCHEDULED" as const,
  calendly_sync_status: "SYNCED" as const,
  appointment_datetime: "2099-01-01T10:00:00.000Z",
};

function scheduledEvent(
  options: {
    origin?: string;
    source?: MessageEventSource | null;
    eventUri?: string;
    inviteeUri?: string;
  } = {},
): EventScheduledEvent {
  const frame = document.querySelector<HTMLIFrameElement>(
    ".calendly-popup-content iframe",
  );
  return new MessageEvent("message", {
    origin: options.origin ?? "https://calendly.com",
    source: options.source ?? frame?.contentWindow,
    data: {
      event: "calendly.event_scheduled",
      payload: {
        event: { uri: options.eventUri ?? payload.event_uri },
        invitee: { uri: options.inviteeUri ?? payload.invitee_uri },
      },
    },
  }) as EventScheduledEvent;
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useCalendlyScheduling active registration retry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    const popup = document.createElement("div");
    popup.className = "calendly-popup-content";
    popup.appendChild(document.createElement("iframe"));
    document.body.appendChild(popup);
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("reenvia as mesmas URIs após PENDING e conclui quando o POST posterior sincroniza", async () => {
    vi.mocked(registerCalendlyScheduledEvent)
      .mockResolvedValueOnce({
        appointment_id: "appointment-1",
        calendly_sync_status: "PENDING",
        appointment_datetime: null,
      })
      .mockResolvedValueOnce({
        appointment_id: "appointment-1",
        calendly_sync_status: "SYNCED",
        appointment_datetime: syncedStatus.appointment_datetime,
      });
    vi.mocked(getCalendlySyncStatus)
      .mockResolvedValueOnce(pendingStatus)
      .mockResolvedValueOnce(syncedStatus);
    const onSynced = vi.fn();
    const { result } = renderHook(() =>
      useCalendlyScheduling({
        successRedirectMessage: "ok",
        onSynced,
      }),
    );
    act(() => result.current.openPopup("appointment-1", "https://calendly.com/a"));
    const listener = vi.mocked(useCalendlyEventListener).mock.calls.at(-1)![0]
      .onEventScheduled!;
    act(() => {
      void listener(scheduledEvent());
    });
    await flushPromises();
    expect(registerCalendlyScheduledEvent).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
      await Promise.resolve();
    });

    expect(registerCalendlyScheduledEvent).toHaveBeenCalledTimes(2);
    expect(vi.mocked(registerCalendlyScheduledEvent).mock.calls[0][1]).toEqual(
      vi.mocked(registerCalendlyScheduledEvent).mock.calls[1][1],
    );
    expect(onSynced).toHaveBeenCalledWith(syncedStatus);
  });

  it("interrompe backoff e chamadas HTTP ao desmontar", async () => {
    vi.mocked(registerCalendlyScheduledEvent).mockResolvedValue({
      appointment_id: "appointment-1",
      calendly_sync_status: "PENDING",
      appointment_datetime: null,
    });
    vi.mocked(getCalendlySyncStatus).mockResolvedValue(pendingStatus);
    const { result, unmount } = renderHook(() =>
      useCalendlyScheduling({ successRedirectMessage: "ok" }),
    );
    act(() => result.current.openPopup("appointment-1", "https://calendly.com/a"));
    const listener = vi.mocked(useCalendlyEventListener).mock.calls.at(-1)![0]
      .onEventScheduled!;
    act(() => {
      void listener(scheduledEvent());
    });
    await flushPromises();
    expect(registerCalendlyScheduledEvent).toHaveBeenCalledTimes(1);
    expect(getCalendlySyncStatus).toHaveBeenCalledTimes(1);

    unmount();
    await vi.runAllTimersAsync();

    expect(registerCalendlyScheduledEvent).toHaveBeenCalledTimes(1);
    expect(getCalendlySyncStatus).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("encerra após oito tentativas sem criar loop de retry", async () => {
    vi.mocked(registerCalendlyScheduledEvent).mockResolvedValue({
      appointment_id: "appointment-1",
      calendly_sync_status: "PENDING",
      appointment_datetime: null,
    });
    vi.mocked(getCalendlySyncStatus).mockResolvedValue(pendingStatus);
    const { result } = renderHook(() =>
      useCalendlyScheduling({ successRedirectMessage: "ok" }),
    );
    act(() => result.current.openPopup("appointment-1", "https://calendly.com/a"));
    const listener = vi.mocked(useCalendlyEventListener).mock.calls.at(-1)![0]
      .onEventScheduled!;
    let synchronization!: Promise<void>;
    act(() => {
      synchronization = Promise.resolve(listener(scheduledEvent()));
    });

    await act(async () => {
      await vi.runAllTimersAsync();
      await synchronization;
    });

    expect(registerCalendlyScheduledEvent).toHaveBeenCalledTimes(8);
    expect(getCalendlySyncStatus).toHaveBeenCalledTimes(8);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(registerCalendlyScheduledEvent).toHaveBeenCalledTimes(8);
  });

  it("não considera FAILED com datetime como sincronização concluída", async () => {
    vi.mocked(registerCalendlyScheduledEvent).mockResolvedValue({
      appointment_id: "appointment-1",
      calendly_sync_status: "PENDING",
      appointment_datetime: null,
    });
    vi.mocked(getCalendlySyncStatus).mockResolvedValue({
      ...syncedStatus,
      status: "CANCELLED",
      calendly_sync_status: "FAILED",
    });
    const onSynced = vi.fn();
    const { result } = renderHook(() =>
      useCalendlyScheduling({ successRedirectMessage: "ok", onSynced }),
    );
    act(() => result.current.openPopup("appointment-1", "https://calendly.com/a"));
    const listener = vi.mocked(useCalendlyEventListener).mock.calls.at(-1)![0]
      .onEventScheduled!;

    await act(async () => {
      await listener(scheduledEvent());
    });

    expect(registerCalendlyScheduledEvent).toHaveBeenCalledTimes(1);
    expect(getCalendlySyncStatus).toHaveBeenCalledTimes(1);
    expect(onSynced).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("ignora evento tardio enviado pelo iframe de uma sessão anterior A após abrir B", async () => {
    const { result } = renderHook(() =>
      useCalendlyScheduling({ successRedirectMessage: "ok" }),
    );
    act(() => result.current.openPopup("appointment-a", "https://calendly.com/a"));
    const oldFrame = document.querySelector<HTMLIFrameElement>(
      ".calendly-popup-content iframe",
    )!;
    const oldSource = oldFrame.contentWindow;
    const replacement = document.createElement("iframe");
    oldFrame.replaceWith(replacement);

    act(() => result.current.openPopup("appointment-b", "https://calendly.com/b"));
    const listener = vi.mocked(useCalendlyEventListener).mock.calls.at(-1)![0]
      .onEventScheduled!;
    const staleEvent = scheduledEvent({
      source: oldSource,
      eventUri: "https://api.calendly.com/scheduled_events/event-a",
      inviteeUri:
        "https://api.calendly.com/scheduled_events/event-a/invitees/invitee-a",
    });

    await act(async () => {
      await listener(staleEvent);
    });

    expect(registerCalendlyScheduledEvent).not.toHaveBeenCalled();
    expect(getCalendlySyncStatus).not.toHaveBeenCalled();
  });

  it("ignora mensagem de origem diferente da URL Calendly aberta", async () => {
    const { result } = renderHook(() =>
      useCalendlyScheduling({ successRedirectMessage: "ok" }),
    );
    act(() => result.current.openPopup("appointment-1", "https://calendly.com/a"));
    const listener = vi.mocked(useCalendlyEventListener).mock.calls.at(-1)![0]
      .onEventScheduled!;
    const forgedEvent = scheduledEvent({ origin: "https://evil.test" });

    await act(async () => {
      await listener(forgedEvent);
    });

    expect(registerCalendlyScheduledEvent).not.toHaveBeenCalled();
    expect(getCalendlySyncStatus).not.toHaveBeenCalled();
  });
});
