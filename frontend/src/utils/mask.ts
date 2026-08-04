/**
 * Utilitários de máscara para documentos (CPF/CNPJ/RG/CEP) e telefone.
 *
 * Documentos e telefone são sempre salvos no banco sem pontuação
 * (stripFormatting antes do submit) e sempre exibidos ao usuário
 * pontuados. Estas funções nunca ocultam dígitos — apenas formatam.
 */

/** Remove tudo que não é dígito. */
export function stripFormatting(value: string): string {
  if (!value) return "";
  return value.replace(/\D/g, "");
}

/** Aplica máscara de CPF (###.###.###-##) enquanto o usuário digita. */
export function applyCpfMask(value: string): string {
  const digits = stripFormatting(value).slice(0, 11);
  let formatted = digits;
  if (digits.length > 3) formatted = digits.slice(0, 3) + "." + digits.slice(3);
  if (digits.length > 6)
    formatted = formatted.slice(0, 7) + "." + digits.slice(6);
  if (digits.length > 9)
    formatted = formatted.slice(0, 11) + "-" + digits.slice(9);
  return formatted;
}

/** Aplica máscara de CNPJ (##.###.###/####-##) enquanto o usuário digita. */
export function applyCnpjMask(value: string): string {
  const digits = stripFormatting(value).slice(0, 14);
  let formatted = digits;
  if (digits.length > 2) formatted = digits.slice(0, 2) + "." + digits.slice(2);
  if (digits.length > 5)
    formatted = formatted.slice(0, 6) + "." + digits.slice(5);
  if (digits.length > 8)
    formatted = formatted.slice(0, 10) + "/" + digits.slice(8);
  if (digits.length > 12)
    formatted = formatted.slice(0, 15) + "-" + digits.slice(12);
  return formatted;
}

/** CPF ou CNPJ, detectado pelo nº de dígitos (a coluna users.cpf é polimórfica: CPF para a maioria dos papéis, CNPJ para SPECIALIST). */
export function applyDocumentMask(value: string): string {
  return stripFormatting(value).length > 11 ? applyCnpjMask(value) : applyCpfMask(value);
}

/** Aplica máscara de CEP (#####-###) enquanto o usuário digita. */
export function applyCepMask(value: string): string {
  const digits = stripFormatting(value).slice(0, 8);
  if (digits.length > 5) {
    return digits.slice(0, 5) + "-" + digits.slice(5);
  }
  return digits;
}

/**
 * Aplica máscara de RG (#.###.###-#, variável de 7 a 9 dígitos).
 * A partir de 10 dígitos, o valor é tratado como CPF (unificação RG/CPF)
 * e formatado como tal.
 */
export function applyRgMask(value: string): string {
  const digits = stripFormatting(value);
  if (digits.length >= 10) {
    return applyCpfMask(digits);
  }
  const truncated = digits.slice(0, 9);
  if (truncated.length === 9) {
    return truncated.replace(/(\d{2})(\d{3})(\d{3})(\d{1})/, "$1.$2.$3-$4");
  }
  if (truncated.length === 8) {
    return truncated.replace(/(\d{2})(\d{3})(\d{3})/, "$1.$2.$3");
  }
  if (truncated.length === 7) {
    return truncated.replace(/(\d{1})(\d{3})(\d{3})/, "$1.$2.$3");
  }
  return truncated;
}

/**
 * Aplica máscara de telefone local: (##) ####-#### (8 dígitos) ou
 * (##) #####-#### (9 dígitos), enquanto o usuário digita.
 */
export function applyPhoneMask(value: string): string {
  const digits = stripFormatting(value).slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : digits;
  const local = digits.slice(2);
  if (local.length <= 4) return `(${digits.slice(0, 2)}) ${local}`;
  if (local.length < 8) return `(${digits.slice(0, 2)}) ${local}`;
  if (local.length === 8) return `(${digits.slice(0, 2)}) ${local.slice(0, 4)}-${local.slice(4)}`;
  return `(${digits.slice(0, 2)}) ${local.slice(0, 5)}-${local.slice(5)}`;
}
