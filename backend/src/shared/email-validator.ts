// Common disposable email domains to block
const DISPOSABLE_DOMAINS = [
  '10minutemail.com',
  'guerrillamail.com',
  'mailinator.com',
  'tempmail.com',
  'throwaway.email',
  'yopmail.com',
  'temp-mail.org',
  'fakemailgenerator.com',
  'trashmail.com',
  'getnada.com',
];

// Common email provider typos
const COMMON_TYPOS: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmil.com': 'gmail.com',
  'yahooo.com': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
  'hotmil.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
};

export interface EmailValidationResult {
  isValid: boolean;
  error?: string;
  suggestion?: string; // Suggested correction for typos
}

/**
 * Validates email format using RFC 5322 compliant regex
 * @param email - Email address to validate
 * @returns true if format is valid
 */
function isValidFormat(email: string): boolean {
  // RFC 5322 Official Standard
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  return emailRegex.test(email);
}

/**
 * Checks if email domain is a known disposable email service
 * @param email - Email address to check
 * @returns true if disposable
 */
function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return DISPOSABLE_DOMAINS.includes(domain);
}

/**
 * Checks for common email typos and suggests corrections
 * @param email - Email address to check
 * @returns Suggested correction or undefined
 */
function checkForTypos(email: string): string | undefined {
  const [localPart, domain] = email.split('@');
  const lowerDomain = domain?.toLowerCase();
  
  if (COMMON_TYPOS[lowerDomain]) {
    return `${localPart}@${COMMON_TYPOS[lowerDomain]}`;
  }
  
  return undefined;
}

/**
 * Validates email address with multiple checks
 * @param email - Email address to validate
 * @returns Validation result with error messages and suggestions
 */
export function validateEmail(email: string): EmailValidationResult {
  // Check if email is provided
  if (!email || typeof email !== 'string') {
    return {
      isValid: false,
      error: 'Email é obrigatório',
    };
  }

  // Trim whitespace
  const trimmedEmail = email.trim();

  // Check length (max 254 characters per RFC 5321)
  if (trimmedEmail.length > 254) {
    return {
      isValid: false,
      error: 'Email muito longo (máximo 254 caracteres)',
    };
  }

  // Check minimum length
  if (trimmedEmail.length < 3) {
    return {
      isValid: false,
      error: 'Email muito curto',
    };
  }

  // Check if contains @ symbol
  if (!trimmedEmail.includes('@')) {
    return {
      isValid: false,
      error: 'Email deve conter @',
    };
  }

  // Check for multiple @ symbols
  if (trimmedEmail.split('@').length > 2) {
    return {
      isValid: false,
      error: 'Email inválido (múltiplos @)',
    };
  }

  // Validate format
  if (!isValidFormat(trimmedEmail)) {
    return {
      isValid: false,
      error: 'Formato de email inválido',
    };
  }

  // Check for disposable emails
  if (isDisposableEmail(trimmedEmail)) {
    return {
      isValid: false,
      error: 'Emails temporários/descartáveis não são permitidos',
    };
  }

  // Check for common typos
  const suggestion = checkForTypos(trimmedEmail);
  if (suggestion) {
    return {
      isValid: false,
      error: 'Possível erro de digitação no domínio do email',
      suggestion,
    };
  }

  // Check local part (before @)
  const [localPart, domain] = trimmedEmail.split('@');
  
  if (localPart.length > 64) {
    return {
      isValid: false,
      error: 'Parte local do email muito longa (máximo 64 caracteres)',
    };
  }

  // Check domain part
  if (!domain || domain.length < 3) {
    return {
      isValid: false,
      error: 'Domínio do email inválido',
    };
  }

  // Check if domain has at least one dot
  if (!domain.includes('.')) {
    return {
      isValid: false,
      error: 'Domínio deve conter pelo menos um ponto (.)',
    };
  }

  // Check for consecutive dots
  if (trimmedEmail.includes('..')) {
    return {
      isValid: false,
      error: 'Email não pode conter pontos consecutivos',
    };
  }

  // Check if starts or ends with dot
  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    return {
      isValid: false,
      error: 'Parte local não pode começar ou terminar com ponto',
    };
  }

  // All validations passed
  return {
    isValid: true,
  };
}

/**
 * Validates email and throws if invalid (for use with NestJS pipes)
 * @param email - Email address to validate
 * @throws Error with validation message
 * @returns Trimmed email if valid
 */
export function validateEmailOrThrow(email: string): string {
  const result = validateEmail(email);
  
  if (!result.isValid) {
    const errorMessage = result.suggestion
      ? `${result.error}. Você quis dizer: ${result.suggestion}?`
      : result.error;
    
    throw new Error(errorMessage);
  }
  
  return email.trim();
}