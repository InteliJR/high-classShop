import api from "./api";

export interface GoogleMeetStatus {
  connected: boolean;
  google_email: string | null;
  expires_at: string | null;
  is_active: boolean;
  last_error: string | null;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

/** Status da conexão da conta Google host de reuniões (ADMIN). */
export async function getGoogleMeetStatus(): Promise<GoogleMeetStatus> {
  const response = await api.get<ApiResponse<GoogleMeetStatus>>(
    "/meetings/google/oauth/status",
    { withCredentials: true },
  );
  return response.data.data;
}

/** Gera a URL de autorização OAuth do Google (ADMIN). */
export async function getGoogleMeetAuthorizeUrl(): Promise<string> {
  const response = await api.get<ApiResponse<{ authorize_url: string }>>(
    "/meetings/google/oauth/authorize",
    { withCredentials: true },
  );
  return response.data.data.authorize_url;
}

/** Desconecta a conta Google host de reuniões (ADMIN). */
export async function disconnectGoogleMeet(): Promise<void> {
  await api.post("/meetings/google/oauth/disconnect", null, {
    withCredentials: true,
  });
}
