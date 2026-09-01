import { describe, expect, it } from "vitest";
import { isMobileViewport } from "./use-is-mobile";

describe("isMobileViewport", () => {
  it("classifica o viewport antes do primeiro efeito do React", () => {
    expect(isMobileViewport(767)).toBe(true);
    expect(isMobileViewport(768)).toBe(false);
  });

  it("é seguro quando não existe window durante renderização no servidor", () => {
    expect(isMobileViewport(undefined)).toBe(false);
  });
});
