import type { UserRole } from "../types/types";

/**
 * Returns the default dashboard route based on user role
 */
export function getRoleBasedRoute(role: UserRole): string {
  switch (role) {
    case 'ADMIN':
      return '/admin/dashboard';
    case 'CONSULTANT':
      return '/consultant/dashboard';
    case 'SPECIALIST':
      return '/specialist/dashboard';
    case 'CUSTOMER':
    default:
      return '/catalog/cars';
  }
}
