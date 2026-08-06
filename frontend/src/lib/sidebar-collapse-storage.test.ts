import { describe, it, expect } from "vitest";
import {
  readSidebarCollapsed,
  writeSidebarCollapsed,
  type KeyValueStorage,
} from "./sidebar-collapse-storage";

function makeMemoryStorage(): KeyValueStorage {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
  };
}

describe("sidebar-collapse-storage", () => {
  it("retorna false quando não há nada salvo", () => {
    expect(readSidebarCollapsed(makeMemoryStorage())).toBe(false);
  });

  it("persiste true e lê de volta", () => {
    const storage = makeMemoryStorage();
    writeSidebarCollapsed(storage, true);
    expect(readSidebarCollapsed(storage)).toBe(true);
  });

  it("persiste false depois de já ter persistido true", () => {
    const storage = makeMemoryStorage();
    writeSidebarCollapsed(storage, true);
    writeSidebarCollapsed(storage, false);
    expect(readSidebarCollapsed(storage)).toBe(false);
  });
});
