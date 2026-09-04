import { describe, expect, it, vi } from "vitest";
import {
  cancelPreviewBeforeDiscard,
  expirePreviewBeforeDiscard,
  shouldRequestPreviewExpiration,
} from "./contract-preview-cancellation";

describe("cancelPreviewBeforeDiscard", () => {
  it("keeps the preview available when provider cancellation fails", async () => {
    const providerFailure = new Error("DocuSign cancellation failed");
    const discard = vi.fn();

    await expect(
      cancelPreviewBeforeDiscard(async () => {
        throw providerFailure;
      }, discard),
    ).rejects.toBe(providerFailure);
    expect(discard).not.toHaveBeenCalled();
  });

  it("discards the preview only after provider cancellation succeeds", async () => {
    const order: string[] = [];

    await cancelPreviewBeforeDiscard(
      async () => {
        order.push("cancelled");
      },
      () => {
        order.push("discarded");
      },
    );

    expect(order).toEqual(["cancelled", "discarded"]);
  });
});

describe("preview expiration policy", () => {
  it("retains the expired preview when provider cancellation fails", async () => {
    const providerFailure = new Error("DocuSign cancellation failed");
    const discard = vi.fn();
    const markExpired = vi.fn();

    await expect(
      expirePreviewBeforeDiscard(
        async () => {
          throw providerFailure;
        },
        discard,
        markExpired,
      ),
    ).rejects.toBe(providerFailure);
    expect(discard).not.toHaveBeenCalled();
    expect(markExpired).not.toHaveBeenCalled();
  });

  it("marks expiration only after cancellation and discard succeed", async () => {
    const order: string[] = [];

    await expirePreviewBeforeDiscard(
      async () => {
        order.push("cancelled");
      },
      () => {
        order.push("discarded");
      },
      () => {
        order.push("expired");
      },
    );

    expect(order).toEqual(["cancelled", "discarded", "expired"]);
  });

  it("requests expiration once and never while another action is busy", () => {
    expect(shouldRequestPreviewExpiration(true, false)).toBe(false);
    expect(shouldRequestPreviewExpiration(false, true)).toBe(false);
    expect(shouldRequestPreviewExpiration(false, false)).toBe(true);
  });
});
