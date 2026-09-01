import { jwtConstants } from './constants';

// Este import já aconteceu — é justamente o ponto: as variáveis abaixo são
// definidas DEPOIS dele, simulando o ConfigModule carregando o .env após o
// módulo ter sido importado. Era esse intervalo que deixava os segredos
// `undefined` para sempre e derrubava toda rota protegida em ambiente local.
describe('jwtConstants — leitura tardia', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it.each([
    ['access', 'JWT_SECRET_ACCESS'],
    ['refresh', 'JWT_SECRET_REFRESH'],
    ['referral', 'JWT_SECRET_REFERRAL'],
    ['advisor', 'JWT_SECRET_ADVISOR'],
  ])('%s lê a variável definida após o import', (prop, envVar) => {
    process.env[envVar] = `valor-de-${envVar}`;

    expect(jwtConstants[prop as keyof typeof jwtConstants]).toBe(
      `valor-de-${envVar}`,
    );
  });

  it('reflete mudanças no ambiente em vez de congelar o primeiro valor', () => {
    process.env.JWT_SECRET_ACCESS = 'primeiro';
    expect(jwtConstants.access).toBe('primeiro');

    process.env.JWT_SECRET_ACCESS = 'segundo';
    expect(jwtConstants.access).toBe('segundo');
  });

  // Falhar com o nome da variável é melhor que assinar/verificar com undefined
  // e devolver 401 sem explicação.
  it('diz qual variável falta em vez de devolver undefined', () => {
    delete process.env.JWT_SECRET_ACCESS;

    expect(() => jwtConstants.access).toThrow(
      'Missing environment variable: JWT_SECRET_ACCESS',
    );
  });

  it('passwordReset cai para o segredo de referral', () => {
    delete process.env.JWT_SECRET_PASSWORD_RESET;
    process.env.JWT_SECRET_REFERRAL = 'referral-secreto';

    expect(jwtConstants.passwordReset).toBe('referral-secreto');
  });

  it('passwordReset prefere o segredo dedicado quando existe', () => {
    process.env.JWT_SECRET_PASSWORD_RESET = 'dedicado';
    process.env.JWT_SECRET_REFERRAL = 'referral-secreto';

    expect(jwtConstants.passwordReset).toBe('dedicado');
  });
});
