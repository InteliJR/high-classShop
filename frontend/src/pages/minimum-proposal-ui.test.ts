import { describe, expect, it } from "vitest";
import settingsPageSource from "./admin/SettingsPage.tsx?raw";
import catalogPageSource from "./catalog/CatalogPage.tsx?raw";
import consultantPageSource from "./consultant/ConsultantProcessDetailPage.tsx?raw";
import negotiationPageSource from "./negotiation/NegotiationPage.tsx?raw";

const proposalPages = [
  ["./admin/SettingsPage.tsx", settingsPageSource],
  ["./negotiation/NegotiationPage.tsx", negotiationPageSource],
  ["./consultant/ConsultantProcessDetailPage.tsx", consultantPageSource],
] as const;

describe("minimum proposal UI", () => {
  it.each(proposalPages)(
    "does not expose minimum proposal copy in %s",
    (_path, source) => {
      expect(source).not.toMatch(
        /valor mínimo|mínimo aceito|porcentagem mínima|minimumProposalEnabled|minimumProposalPercentage/i,
      );
    },
  );

  it("keeps the independent minimum price catalog filter", () => {
    expect(catalogPageSource).toContain("Preço mínimo");
  });
});
