import api from "./api";

export interface UserProfile {
  id: string;
  name: string;
  surname: string;
  email: string;
  role: string;
  cpf: string;
  rg: string;
  civil_state: string | null;
  speciality: string | null;
  calendly_url: string | null;
  created_at: string;
}

export interface UpdateUserData {
  name?: string;
  surname?: string;
  cpf?: string;
  rg?: string;
  calendly_url?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * Get user profile by ID
 * @param userId - The ID of the user
 */
export async function getUserById(userId: string): Promise<UserProfile> {
  const response = await api.get<ApiResponse<UserProfile>>(`/users/${userId}`, {
    withCredentials: true,
  });
  return response.data.data;
}

/**
 * Update user profile
 * @param userId - The ID of the user to update
 * @param data - Data to update
 */
export async function updateUser(
  userId: string,
  data: UpdateUserData
): Promise<UserProfile> {
  const response = await api.patch<ApiResponse<UserProfile>>(
    `/users/${userId}`,
    data,
    { withCredentials: true }
  );
  return response.data.data;
}
