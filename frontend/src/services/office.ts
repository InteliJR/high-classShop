import api from './api';

export interface OfficeConsultant {
  id: string;
  name: string;
  surname: string;
  email: string;
  is_active: boolean;
  deactivated_at: string | null;
  commission_rate: number | null;
  bank: string | null;
  agency: string | null;
  checking_account: string | null;
  created_at: string;
  clients_count: number;
}

export interface OfficeClient {
  id: string;
  name: string;
  surname: string;
  email: string;
  cpf: string;
  civil_state: string | null;
  consultant_id: string | null;
  consultant: { id: string; name: string; surname: string } | null;
  created_at: string;
}

export interface OfficeCompany {
  id: string;
  name: string;
  cnpj: string;
  logo: string | null;
  logoUrl?: string | null;
  description: string | null;
  commission_rate: number | null;
  bank: string | null;
  agency: string | null;
  checking_account: string | null;
  color_identity: string[];
}

export interface InviteJobSummary {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'FAILED';
  total_items: number;
  success_items: number;
  failed_items: number;
  duplicate_items: number;
  created_at: string;
  finished_at: string | null;
}

export interface InviteJobDetail extends InviteJobSummary {
  jobId: string;
  status: InviteJobSummary['status'];
  totalItems: number;
  processedItems: number;
  successItems: number;
  failedItems: number;
  duplicateItems: number;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
  done: boolean;
  items: Array<{
    row_number: number;
    name: string;
    email: string;
    status: 'PENDING' | 'PROCESSING' | 'SENT' | 'ACCEPTED' | 'FAILED' | 'DUPLICATE';
    error_message: string | null;
    consultant_id: string | null;
  }>;
}

// Convite OFFICE (validate + register) — para uso na página /register-office (público)
export async function validateOfficeInvite(token: string): Promise<{
  companyId: string;
  companyName: string;
  email: string;
}> {
  const response = await api.post('/auth/validate-office-invite', { token });
  return response.data.data;
}

export async function registerOffice(data: {
  invite_token: string;
  name: string;
  surname: string;
  cpf: string;
  rg: string;
  password: string;
}): Promise<unknown> {
  const response = await api.post('/auth/register-office', data);
  return response.data;
}

// ADMIN convida OFFICE de uma Company
export async function adminInviteOffice(companyId: string, email: string) {
  const response = await api.post(`/companies/${companyId}/invite-office`, { email });
  return response.data;
}

export const officeService = {
  dashboard: () => api.get('office/dashboard').then((r) => r.data),

  // Consultores
  listConsultants: (params: { active?: 'true' | 'false'; q?: string } = {}) =>
    api.get<OfficeConsultant[]>('office/consultants', { params }).then((r) => r.data),
  updateConsultant: (id: string, payload: Partial<OfficeConsultant>) =>
    api.patch(`office/consultants/${id}`, payload).then((r) => r.data),
  deactivateConsultant: (id: string) =>
    api.delete(`office/consultants/${id}`).then((r) => r.data),
  reactivateConsultant: (id: string) =>
    api.post(`office/consultants/${id}/reactivate`).then((r) => r.data),
  inviteConsultant: (email: string) =>
    api.post('office/consultants/invite', { email }).then((r) => r.data),

  // Clientes (RO)
  listClients: (params: { consultantId?: string; q?: string } = {}) =>
    api.get<OfficeClient[]>('office/clients', { params }).then((r) => r.data),

  // Company
  getCompany: () => api.get<OfficeCompany>('office/company').then((r) => r.data),
  updateCompany: (payload: Partial<OfficeCompany>) =>
    api.patch<OfficeCompany>('office/company', payload).then((r) => r.data),
  uploadLogo: (file: File) => {
    const fd = new FormData();
    fd.append('logo', file);
    return api
      .post<{ id: string; logo: string | null; logoUrl: string | null }>(
        'office/company/logo',
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      .then((r) => r.data);
  },

  // Batch invite
  createInviteJob: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api
      .post('office/invite-jobs', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data);
  },
  listInviteJobs: () => api.get<InviteJobSummary[]>('office/invite-jobs').then((r) => r.data),
  getInviteJob: (id: string) =>
    api.get<InviteJobDetail>(`office/invite-jobs/${id}`).then((r) => r.data),
};
