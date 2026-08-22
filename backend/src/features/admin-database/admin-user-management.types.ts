export type ChangeBlockerCode =
  | 'ROLE_UNCHANGED'
  | 'SPECIALITY_UNCHANGED'
  | 'SPECIALIST_DETAILS_UNCHANGED'
  | 'COMPANY_REQUIRED'
  | 'COMPANY_NOT_FOUND'
  | 'SPECIALITY_REQUIRED'
  | 'CUSTOMER_HAS_CONSULTANT'
  | 'CUSTOMER_HAS_ADVISOR'
  | 'CONSULTANT_HAS_CLIENTS'
  | 'CONSULTANT_HAS_ADVISEES'
  | 'SPECIALIST_HAS_ACTIVE_PRODUCTS'
  | 'SPECIALIST_HAS_PENDING_APPOINTMENTS'
  | 'SPECIALIST_HAS_OPEN_PROCESSES'
  | 'OFFICE_REPLACEMENT_REQUIRED'
  | 'OFFICE_REPLACEMENT_INVALID'
  | 'OFFICE_CONFLICT'
  | 'CONCURRENT_CHANGE'
  | 'LAST_ACTIVE_ADMIN';

export type ChangeBlocker = {
  code: ChangeBlockerCode;
  message: string;
  count?: number;
};

export type ChangeValidationResult = {
  allowed: boolean;
  summary: string;
  blockers: ChangeBlocker[];
};
