// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  ADMIN_SPECIALIST_TARGET_KEY,
  adminJourneyRoute,
  attachAdminSpecialistTarget,
  persistAdminSpecialistTarget,
  readAdminSpecialistTarget,
} from "./admin-specialist-journey";

describe("admin specialist journey context", () => {
  beforeEach(() => localStorage.clear());

  it("persists only the represented specialist identity", () => {
    persistAdminSpecialistTarget("specialist-1");
    expect(readAdminSpecialistTarget()).toBe("specialist-1");
    expect(localStorage.getItem(ADMIN_SPECIALIST_TARGET_KEY)).toBe(
      "specialist-1",
    );
    persistAdminSpecialistTarget(null);
    expect(readAdminSpecialistTarget()).toBeNull();
  });

  it("adds the explicit target only to admin journey domain requests", () => {
    const config = attachAdminSpecialistTarget(
      { url: "/processes/p1/status", params: { page: 1 } } as any,
      "ADMIN",
      "specialist-1",
    );
    expect(config.params).toEqual({
      page: 1,
      target_specialist_id: "specialist-1",
    });
    expect(
      attachAdminSpecialistTarget(
        { url: "/processes/p1/status" } as any,
        "SPECIALIST",
        "specialist-1",
      ).params,
    ).toBeUndefined();
    expect(
      attachAdminSpecialistTarget(
        { url: "/admin/database/users" } as any,
        "ADMIN",
        "specialist-1",
      ).params,
    ).toBeUndefined();
  });

  it("keeps every operational route inside the admin workspace", () => {
    expect(adminJourneyRoute("negotiation", "p1")).toBe(
      "/admin/journey/processes/p1/negotiation",
    );
    expect(adminJourneyRoute("meeting", "p1")).toBe(
      "/admin/journey/processes/p1/meeting",
    );
    expect(adminJourneyRoute("contract", "p1")).toBe(
      "/admin/journey/contracts/new?processId=p1",
    );
  });
});
