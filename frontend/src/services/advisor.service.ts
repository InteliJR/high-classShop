import api from "./api";

export interface AdvisorRecord {
  id: string;
  customer_id: string;
  advisor_id: string | null;
  email: string;
  accepted_at: string | null;
  created_at: string;
  advisor: {
    id: string;
    name: string;
    surname: string;
    email: string;
  } | null;
}

export interface AdvisedClient {
  relation_id: string;
  accepted_at: string;
  customer: {
    id: string;
    name: string;
    surname: string;
    email: string;
    processesAsClient: {
      id: string;
      status: string;
      product_type: string | null;
      created_at: string;
    }[];
  };
}

export async function inviteAdvisor(email: string): Promise<AdvisorRecord> {
  const res = await api.post("/customers/me/invite-advisor", { email });
  return res.data.data;
}

export async function getMyAdvisor(): Promise<AdvisorRecord | null> {
  const res = await api.get("/customers/me/advisor");
  return res.data.data;
}

export async function removeAdvisor(): Promise<void> {
  await api.delete("/customers/me/advisor");
}

export async function acceptAdvisorInvite(token: string): Promise<{ accepted?: boolean; already_accepted?: boolean }> {
  const res = await api.post("/auth/accept-advisor-invite", { token });
  return res.data.data;
}

export async function getAdvisedClients(): Promise<AdvisedClient[]> {
  const res = await api.get("/advisors/me/clients");
  return res.data.data;
}
