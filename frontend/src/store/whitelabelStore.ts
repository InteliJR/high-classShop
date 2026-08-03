// frontend/src/store/whitelabelStore.ts
import { create } from "zustand";
import type { CompanyBranding } from "../types/types";

// ponytail: brand do whitelabel vive em memória; sobrevive à navegação SPA.
// Um refresh fora de /i/:slug perde o brand (aceitável) — persistir em
// sessionStorage se essa UX passar a importar.
interface WhitelabelState {
  company: CompanyBranding | null;
  setCompany: (c: CompanyBranding | null) => void;
}

export const useWhitelabel = create<WhitelabelState>((set) => ({
  company: null,
  setCompany: (company) => set({ company }),
}));
