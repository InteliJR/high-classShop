import type { InternalAxiosRequestConfig } from "axios";

export const ADMIN_SPECIALIST_TARGET_KEY = "highclass.admin.specialistTarget";

const TARGETED_RESOURCES = [
  "cars",
  "boats",
  "aircrafts",
  "processes",
  "appointments",
  "meetings",
  "proposals",
  "contracts",
  "product-import-jobs",
] as const;

export function readAdminSpecialistTarget(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ADMIN_SPECIALIST_TARGET_KEY);
}

export function persistAdminSpecialistTarget(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(ADMIN_SPECIALIST_TARGET_KEY, id);
  else window.localStorage.removeItem(ADMIN_SPECIALIST_TARGET_KEY);
}

export function isTargetedJourneyRequest(url?: string): boolean {
  if (!url) return false;
  const pathname = url.replace(/^https?:\/\/[^/]+\/?/, "").replace(/^\//, "");
  return TARGETED_RESOURCES.some(
    (resource) => pathname === resource || pathname.startsWith(`${resource}/`),
  );
}

export function attachAdminSpecialistTarget(
  config: InternalAxiosRequestConfig,
  role: string | undefined,
  targetId: string | null,
): InternalAxiosRequestConfig {
  if (role !== "ADMIN" || !targetId || !isTargetedJourneyRequest(config.url)) {
    return config;
  }
  config.params = { ...(config.params ?? {}), target_specialist_id: targetId };
  return config;
}

export function adminJourneyRoute(
  section: "products" | "processes" | "negotiation" | "meeting" | "contract",
  processId?: string,
): string {
  if (section === "negotiation" && processId) {
    return `/admin/journey/processes/${processId}/negotiation`;
  }
  if (section === "meeting" && processId) {
    return `/admin/journey/processes/${processId}/meeting`;
  }
  if (section === "contract") {
    return `/admin/journey/contracts/new${processId ? `?processId=${processId}` : ""}`;
  }
  return `/admin/journey/${section}`;
}
