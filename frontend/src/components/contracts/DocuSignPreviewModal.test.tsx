import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import DocuSignPreviewModal from "./DocuSignPreviewModal";

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
});
