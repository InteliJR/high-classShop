export const SIDEBAR_COLLAPSE_STORAGE_KEY = "hcs-sidebar-collapsed";

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readSidebarCollapsed(storage: KeyValueStorage): boolean {
  return storage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY) === "1";
}

export function writeSidebarCollapsed(storage: KeyValueStorage, collapsed: boolean): void {
  storage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, collapsed ? "1" : "0");
}
