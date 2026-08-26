import type { UserRole } from "../types/types";

export type NavigationIcon =
  | "home"
  | "dashboard"
  | "building"
  | "users"
  | "user-cog"
  | "car"
  | "ship"
  | "plane"
  | "package"
  | "file-pen"
  | "settings"
  | "percent"
  | "database"
  | "calculator"
  | "clipboard-list"
  | "user-plus"
  | "log-in";

export interface NavigationItem {
  to: string;
  label: string;
  icon: NavigationIcon;
}

export const PUBLIC_CATALOG_LINKS: readonly NavigationItem[] = [
  { to: "/catalog/cars", label: "Carros", icon: "car" },
  { to: "/catalog/boats", label: "Embarcações", icon: "ship" },
  { to: "/catalog/aircrafts", label: "Aeronaves", icon: "plane" },
];

export const PUBLIC_SIDEBAR_LINKS: readonly NavigationItem[] = [
  ...PUBLIC_CATALOG_LINKS,
  { to: "/register", label: "Cadastrar-se", icon: "user-plus" },
  { to: "/login", label: "Login", icon: "log-in" },
];

const ROLE_SIDEBAR_LINKS: Record<
  UserRole,
  readonly NavigationItem[]
> = {
  CUSTOMER: [
    { to: "/customer/home", label: "Home", icon: "home" },
    { to: "/customer/consultoria", label: "Consultoria", icon: "users" },
    {
      to: "/customer/processes",
      label: "Meus Processos",
      icon: "file-pen",
    },
    ...PUBLIC_CATALOG_LINKS,
  ],
  CONSULTANT: [
    {
      to: "/consultant/dashboard",
      label: "Dashboard",
      icon: "dashboard",
    },
    {
      to: "/consultant/clients",
      label: "Meus Clientes",
      icon: "users",
    },
    {
      to: "/consultant/processes",
      label: "Processos",
      icon: "file-pen",
    },
    ...PUBLIC_CATALOG_LINKS,
  ],
  SPECIALIST: [
    {
      to: "/specialist/dashboard",
      label: "Dashboard",
      icon: "dashboard",
    },
    {
      to: "/specialist/products",
      label: "Meus produtos",
      icon: "package",
    },
    {
      to: "/specialist/processes",
      label: "Meus processos",
      icon: "file-pen",
    },
  ],
  ADMIN: [
    { to: "/admin/dashboard", label: "Dashboard", icon: "dashboard" },
    { to: "/admin/companies", label: "Escritórios", icon: "building" },
    { to: "/office/consultants", label: "Consultores", icon: "users" },
    {
      to: "/admin/specialists",
      label: "Especialistas",
      icon: "user-cog",
    },
    { to: "/admin/commissions", label: "Comissões", icon: "percent" },
    { to: "/admin/calculator", label: "Calculadora", icon: "calculator" },
    { to: "/admin/database", label: "Base de dados", icon: "database" },
    { to: "/admin/settings", label: "Configurações", icon: "settings" },
    { to: "/admin/my-company", label: "Minha Empresa", icon: "building" },
  ],
  OFFICE: [
    { to: "/office/dashboard", label: "Dashboard", icon: "dashboard" },
    { to: "/office/consultants", label: "Consultores", icon: "users" },
    { to: "/office/clients", label: "Clientes", icon: "user-cog" },
    {
      to: "/office/processes",
      label: "Processos",
      icon: "clipboard-list",
    },
    { to: "/office/company", label: "Minha Empresa", icon: "building" },
  ],
};

export function getSidebarLinks(
  role: UserRole | null | undefined,
): readonly NavigationItem[] {
  if (role == null) return PUBLIC_SIDEBAR_LINKS;
  return ROLE_SIDEBAR_LINKS[role] ?? [];
}
