// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import DocuSignPreviewModal from "./DocuSignPreviewModal";

afterEach(cleanup);

describe("DocuSignPreviewModal cancellation state", () => {
  it("keeps a cancellation failure visible inside the retained modal", () => {
    const html = renderToStaticMarkup(
      <DocuSignPreviewModal
        previewUrl="https://demo.docusign.net/preview"
        envelopeId="envelope-1"
        expiresAt="2099-01-01T00:00:00.000Z"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onExpired={vi.fn()}
        cancellationError="Não foi possível cancelar o preview. Tente novamente."
      />,
    );

    expect(html).toContain(
      "Não foi possível cancelar o preview. Tente novamente.",
    );
    expect(html).toContain('role="alert"');
  });

  it("disables every modal action and reports cancellation progress", () => {
    const html = renderToStaticMarkup(
      <DocuSignPreviewModal
        previewUrl="https://demo.docusign.net/preview"
        envelopeId="envelope-1"
        expiresAt="2099-01-01T00:00:00.000Z"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onExpired={vi.fn()}
        isCancelling
      />,
    );

    expect(html).toContain("Cancelando preview...");
    expect(html.match(/<button[^>]*disabled/g)).toHaveLength(3);
    expect(html).toContain('aria-busy="true"');
  });

  it("routes trusted DocuSign send/cancel messages to the real modal callbacks", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <DocuSignPreviewModal
        previewUrl="https://demo.docusign.net/preview"
        envelopeId="envelope-1"
        expiresAt="2099-01-01T00:00:00.000Z"
        onConfirm={onConfirm}
        onCancel={onCancel}
        onExpired={vi.fn()}
      />,
    );

    fireEvent(
      window,
      new MessageEvent("message", {
        origin: "https://demo.docusign.net",
        data: { event: "send" },
      }),
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent(
      window,
      new MessageEvent("message", {
        origin: "https://evil.example.test",
        data: "cancel",
      }),
    );
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
