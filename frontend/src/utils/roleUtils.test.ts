import { describe, expect, it } from "vitest";
import { getBrandHomeRoute } from "./roleUtils";

describe("getBrandHomeRoute", () => {
  it("envia visitantes para o catálogo de carros", () => {
    expect(getBrandHomeRoute(undefined)).toBe("/catalog/cars");
    expect(getBrandHomeRoute(null)).toBe("/catalog/cars");
  });

  it("envia cada papel autenticado para sua página inicial", () => {
    expect(getBrandHomeRoute("CUSTOMER")).toBe("/customer/home");
    expect(getBrandHomeRoute("CONSULTANT")).toBe("/consultant/dashboard");
    expect(getBrandHomeRoute("SPECIALIST")).toBe("/specialist/dashboard");
    expect(getBrandHomeRoute("ADMIN")).toBe("/admin/dashboard");
    expect(getBrandHomeRoute("OFFICE")).toBe("/office/dashboard");
  });
});
