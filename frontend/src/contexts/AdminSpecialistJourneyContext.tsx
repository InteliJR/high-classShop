import { createContext, useContext } from "react";
import type { Specialist } from "../services/specialists.service";

export type AdminSpecialistJourneyValue = {
  specialist: Specialist;
  targetSpecialistId: string;
};

const AdminSpecialistJourneyContext =
  createContext<AdminSpecialistJourneyValue | null>(null);

export const AdminSpecialistJourneyProvider =
  AdminSpecialistJourneyContext.Provider;

export function useAdminSpecialistJourney(): AdminSpecialistJourneyValue | null {
  return useContext(AdminSpecialistJourneyContext);
}
