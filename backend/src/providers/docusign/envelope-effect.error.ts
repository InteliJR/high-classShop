export type EnvelopeEffectState =
  | 'DRAFT_CONFIRMED'
  | 'SEND_CONFIRMED'
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
    public readonly providerStatus?: string,
  ) {
    super(
      effectState === 'SEND_INDETERMINATE'
        ? 'Não foi possível confirmar o resultado do envio do envelope.'
        : effectState === 'SEND_CONFIRMED'
          ? 'O envelope externo já foi enviado.'
        : 'Um rascunho externo foi criado antes da falha da operação.',
    );
    this.name = EnvelopeEffectError.name;
  }
}

/**
 * A create request may have reached DocuSign even when every HTTP response was
 * lost. Callers must keep the operation id and reconcile instead of issuing a
 * new create with an unrelated id.
 */
export class EnvelopeCreationAmbiguousError extends Error {
  constructor(
    public readonly transactionId: string,
    public readonly cause: unknown,
  ) {
    super('Não foi possível confirmar a criação do envelope externo.');
    this.name = EnvelopeCreationAmbiguousError.name;
  }
}
