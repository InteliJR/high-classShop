export type EnvelopeEffectState =
  | 'DRAFT_CONFIRMED'
  | 'SEND_INDETERMINATE';

/**
 * Carries only the provider identifiers needed to make a safe compensation
 * decision. The original cause is retained for server-side logging and must
 * never be copied into an HTTP response.
 */
export class EnvelopeEffectError extends Error {
  constructor(
    public readonly envelopeId: string,
    public readonly effectState: EnvelopeEffectState,
    public readonly cause: unknown,
  ) {
    super(
      effectState === 'SEND_INDETERMINATE'
        ? 'Não foi possível confirmar o resultado do envio do envelope.'
        : 'Um rascunho externo foi criado antes da falha da operação.',
    );
    this.name = EnvelopeEffectError.name;
  }
}
