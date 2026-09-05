import { DocuSignClient } from './docusign.client';
import axios from 'axios';

describe('DocuSignClient privacy and transaction recovery', () => {
  function makeClient() {
    const client = Object.create(DocuSignClient.prototype) as DocuSignClient;
    const logger = {
      debug: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    Object.assign(client as any, {
      accountId: 'account-1',
      logger,
      getAccessToken: jest.fn().mockResolvedValue('token'),
    });
    return { client, logger };
  }

  it('looks up envelopes by the exact transaction id without a provider POST', async () => {
    const { client } = makeClient();
    const get = jest.fn().mockResolvedValue({
      envelopes: [{ envelopeId: 'envelope-1', status: 'created' }],
    });
    (client as any).get = get;

    const result = await client.findEnvelopesByTransactionId(
      '11111111-1111-4111-8111-111111111111',
    );

    expect(get).toHaveBeenCalledWith(
      '/v2.1/accounts/account-1/envelopes?transaction_ids=11111111-1111-4111-8111-111111111111',
      'token',
    );
    expect(result).toEqual([{ envelopeId: 'envelope-1', status: 'created' }]);
  });

  it.each(['post', 'put'])(
    'does not log request payloads from %s',
    async (method) => {
      const { client, logger } = makeClient();
      (client as any).makeRequest = jest.fn().mockResolvedValue({ ok: true });
      const secret = 'CPF-RG-ADDRESS-BANK-SECRET';

      await (client as any)[method](
        '/safe-path',
        { seller_cpf: secret },
        'token',
      );

      const logged = Object.values(logger)
        .flatMap((mock: any) => mock.mock.calls.flat())
        .join(' ');
      expect(logged).not.toContain(secret);
    },
  );

  it('does not retry the provider POST that creates a template envelope', async () => {
    const { client } = makeClient();
    Object.assign(client as any, {
      baseUrl: 'https://example.test/restapi',
      REQUEST_TIMEOUT_MS: 10,
      RETRY_DELAY_MS: 0,
      MAX_RETRIES: 3,
    });
    const timeout = Object.assign(new Error('timeout'), {
      code: 'ECONNABORTED',
      isAxiosError: true,
    });
    const post = jest.spyOn(axios, 'post').mockRejectedValue(timeout);

    await expect(
      client.createEnvelopeFromTemplate({
        transactionId: '11111111-1111-4111-8111-111111111111',
        templateId: 'template-1',
        status: 'created',
        templateRoles: [],
      }),
    ).rejects.toBe(timeout);

    expect(post).toHaveBeenCalledTimes(1);
    post.mockRestore();
  });
});
