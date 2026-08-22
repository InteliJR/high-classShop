import { requiredEnv } from 'src/shared/utils/required-env';

/**
 * Segredos JWT lidos sob demanda, não no import.
 *
 * Antes eram propriedades comuns, avaliadas quando este módulo era importado —
 * o que acontece ANTES de o ConfigModule carregar o `.env` para process.env.
 * Com variáveis de ambiente reais (produção) isso funciona; com arquivo `.env`
 * (desenvolvimento) todos os segredos ficavam `undefined`.
 *
 * O efeito era silencioso e difícil de diagnosticar: o login assinava com o
 * segredo certo (injetado via ConfigService), mas o AuthGuard verificava com
 * `undefined` e devolvia 401 em toda rota protegida — dava a impressão de que
 * o próprio login estava quebrado.
 *
 * Getters resolvem no momento do uso, quando o `.env` já foi carregado. Se o
 * segredo faltar de verdade, o erro diz qual variável falta em vez de virar
 * um 401 sem explicação.
 */
export const jwtConstants = {
  get access(): string {
    return requiredEnv(process.env.JWT_SECRET_ACCESS, 'JWT_SECRET_ACCESS');
  },
  get refresh(): string {
    return requiredEnv(process.env.JWT_SECRET_REFRESH, 'JWT_SECRET_REFRESH');
  },
  get referral(): string {
    return requiredEnv(process.env.JWT_SECRET_REFERRAL, 'JWT_SECRET_REFERRAL');
  },
  get advisor(): string {
    return requiredEnv(process.env.JWT_SECRET_ADVISOR, 'JWT_SECRET_ADVISOR');
  },
  /** Cai para o segredo de referral quando não há um dedicado — comportamento preservado. */
  get passwordReset(): string {
    return requiredEnv(
      process.env.JWT_SECRET_PASSWORD_RESET ||
        process.env.JWT_SECRET_REFERRAL,
      'JWT_SECRET_PASSWORD_RESET (ou JWT_SECRET_REFERRAL)',
    );
  },
};
