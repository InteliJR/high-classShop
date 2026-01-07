/**
 * Utilitário para formatação e validação de datas
 * Usado em toda a aplicação para garantir consistência com UTC e ISO 8601
 */

/**
 * Converte uma string ISO 8601 ou Date para Date object
 * Se a data for inválida ou undefined, retorna null
 *
 * @param dateInput - String ISO 8601 ou Date object
 * @returns Date object ou null se inválido
 *
 * @example
 * parseDate("2024-10-10T14:00:00Z") // new Date("2024-10-10T14:00:00Z")
 * parseDate(new Date()) // new Date()
 * parseDate(undefined) // null
 * parseDate("invalid") // null
 */
export function parseDate(dateInput: string | Date | undefined): Date | null {
  if (!dateInput) return null;

  const date = new Date(dateInput);
  return isValidDate(date) ? date : null;
}

/**
 * Valida se uma Date é válida (não é Invalid Date)
 *
 * @param date - Date object para validar
 * @returns true se válida, false se inválida
 *
 * @example
 * isValidDate(new Date("2024-10-10T14:00:00Z")) // true
 * isValidDate(new Date("invalid")) // false
 */
export function isValidDate(date: Date): boolean {
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Formata uma Date para string ISO 8601 UTC
 *
 * @param date - Date object para formatar
 * @returns String em formato ISO 8601 UTC (ex: "2024-10-10T14:00:00.000Z")
 *
 * @example
 * formatToISO(new Date("2024-10-10T14:00:00Z")) // "2024-10-10T14:00:00.000Z"
 */
export function formatToISO(date: Date): string {
  return date.toISOString();
}

/**
 * Verifica se uma data é no futuro
 *
 * @param date - Date object para verificar
 * @returns true se for futuro, false se for passado ou igual a agora
 *
 * @example
 * isFutureDate(new Date(Date.now() + 86400000)) // true (amanhã)
 * isFutureDate(new Date()) // false (agora)
 */
export function isFutureDate(date: Date): boolean {
  return date > new Date();
}

/**
 * Gera sugestões de horários futuros (próximas horas disponíveis)
 * Útil para sugerir alternativas quando há conflito de horário
 *
 * @param baseDate - Data base para começar as sugestões
 * @param count - Quantidade de sugestões (default: 3)
 * @returns Array com strings ISO 8601 UTC
 *
 * @example
 * suggestNextAvailableSlots(new Date("2024-10-10T14:00:00Z"), 3)
 * // ["2024-10-10T15:00:00.000Z", "2024-10-10T16:00:00.000Z", "2024-10-10T17:00:00.000Z"]
 */
export function suggestNextAvailableSlots(
  baseDate: Date,
  count: number = 3,
): string[] {
  const suggestions: string[] = [];
  const currentDate = new Date(baseDate);

  for (let i = 1; i <= count; i++) {
    // Adicionar 1 hora a cada iteração
    currentDate.setHours(currentDate.getHours() + 1);
    suggestions.push(currentDate.toISOString());
  }

  return suggestions;
}

/**
 * Calcula a diferença em horas entre duas datas
 *
 * @param dateA - Primeira data
 * @param dateB - Segunda data
 * @returns Diferença em horas
 *
 * @example
 * hoursDifference(new Date("2024-10-10T14:00:00Z"), new Date("2024-10-10T16:00:00Z")) // 2
 */
export function hoursDifference(dateA: Date, dateB: Date): number {
  const diffMs = Math.abs(dateB.getTime() - dateA.getTime());
  return diffMs / (1000 * 60 * 60);
}
