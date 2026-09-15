// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const proposalPages = [
  "./admin/SettingsPage.tsx",
  "./negotiation/NegotiationPage.tsx",
  "./consultant/ConsultantProcessDetailPage.tsx",
];

describe("minimum proposal UI", () => {
  it.each(proposalPages)(
    "does not expose minimum proposal copy in %s",
    (path) => {
      const source = readFileSync(new URL(path, import.meta.url), "utf8");

      expect(source).not.toMatch(
        /valor mínimo|mínimo aceito|porcentagem mínima|minimumProposalEnabled|minimumProposalPercentage/i,
      );
    },
  );

  it("keeps the independent minimum price catalog filter", () => {
    const source = readFileSync(
      new URL("./catalog/CatalogPage.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("Preço mínimo");
  });
});
