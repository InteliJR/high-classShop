import api from "./api";

export interface Setting {
  key: string;
  value: string;
  description: string | null;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * Get all settings
 * @returns List of all settings
 */
export async function getSettings(): Promise<Setting[]> {
  const response = await api.get<ApiResponse<Setting[]>>("/settings", {
    withCredentials: true,
  });
  return response.data.data;
}

/**
 * Get a specific setting by key
 * @param key - Setting key
 * @returns The setting value
 */
export async function getSetting(key: string): Promise<Setting> {
  const response = await api.get<ApiResponse<Setting>>(`/settings/${key}`, {
    withCredentials: true,
  });
  return response.data.data;
}

/**
 * Update a setting (Admin only)
 * @param key - Setting key
 * @param value - New value
 * @returns Updated setting
 */
export async function updateSetting(
  key: string,
  value: string
): Promise<Setting> {
  const response = await api.patch<ApiResponse<Setting>>(
    `/settings/${key}`,
    { value },
    { withCredentials: true }
  );
  return response.data.data;
}

// Convenience functions for specific settings
export async function isMinimumProposalEnabled(): Promise<boolean> {
  try {
    const setting = await getSetting("minimum_proposal_enabled");
    return setting.value === "true";
  } catch {
    return true; // Default: enabled
  }
}

export async function getMinimumProposalPercentage(): Promise<number> {
  try {
    const setting = await getSetting("minimum_proposal_percentage");
    return parseFloat(setting.value) || 0.8;
  } catch {
    return 0.8; // Default: 80%
  }
}
