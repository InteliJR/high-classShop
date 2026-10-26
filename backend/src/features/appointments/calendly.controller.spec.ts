import { CalendlyController } from './calendly.controller';

describe('CalendlyController OAuth callback public errors', () => {
  const originalFrontendUrl = process.env.FRONTEND_URL;

  beforeAll(() => {
    process.env.FRONTEND_URL = 'https://frontend.example.test';
  });

  afterAll(() => {
    if (originalFrontendUrl === undefined) {
      delete process.env.FRONTEND_URL;
    } else {
      process.env.FRONTEND_URL = originalFrontendUrl;
    }
  });

  function responseHarness() {
    return { redirect: jest.fn((url: string) => url) } as any;
  }

  it('não expõe error_description arbitrária devolvida pelo provedor', async () => {
    const controller = new CalendlyController({} as any);
    const response = responseHarness();
    const secret = 'client_secret=very-sensitive-value';

    await controller.oauthCallback(
      undefined,
      undefined,
      'access_denied',
      secret,
      response,
    );

    const redirect = response.redirect.mock.calls[0][0];
    expect(redirect).toBe(
      'https://frontend.example.test/profile?calendly=error&reason=oauth_denied',
    );
    expect(redirect).not.toContain('very-sensitive-value');
  });

  it('não expõe detalhes internos de falha do callback', async () => {
    const secret = 'upstream access_token=very-sensitive-value';
    const service = {
      handleOAuthCallback: jest.fn().mockRejectedValue(new Error(secret)),
    };
    const controller = new CalendlyController(service as any);
    const response = responseHarness();

    await controller.oauthCallback(
      'code',
      'state',
      undefined,
      undefined,
      response,
    );

    const redirect = response.redirect.mock.calls[0][0];
    expect(redirect).toBe(
      'https://frontend.example.test/profile?calendly=error&reason=oauth_callback_failed',
    );
    expect(redirect).not.toContain('very-sensitive-value');
  });
});
