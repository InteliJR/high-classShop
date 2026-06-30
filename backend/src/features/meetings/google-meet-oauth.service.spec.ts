import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GoogleMeetOAuthService } from './google-meet-oauth.service';

function mkPrisma() {
  return {
    googleMeetOauthState: {
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    googleMeetConnection: {
      findFirst: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn().mockResolvedValue([]),
  } as any;
}

describe('GoogleMeetOAuthService', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = {
      ...OLD_ENV,
      GOOGLE_OAUTH_CLIENT_ID: 'client-id.apps.googleusercontent.com',
      GOOGLE_OAUTH_CLIENT_SECRET: 'secret',
      GOOGLE_OAUTH_REDIRECT_URI:
        'http://localhost:3000/api/meetings/google/oauth/callback',
      GOOGLE_MEET_TOKEN_ENCRYPTION_KEY: '12345678901234567890123456789012', // 32 bytes
    };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('createAuthorizeUrl monta URL com offline/consent/scopes e grava state', async () => {
    const prisma = mkPrisma();
    const svc = new GoogleMeetOAuthService(prisma);

    const { authorize_url } = await svc.createAuthorizeUrl('admin-1');

    expect(prisma.googleMeetOauthState.create).toHaveBeenCalledTimes(1);
    expect(authorize_url).toContain('access_type=offline');
    expect(authorize_url).toContain('prompt=consent');
    expect(authorize_url).toContain('meetings.space.created');
    expect(authorize_url).toContain('meetings.space.settings');
    expect(authorize_url).toMatch(/state=[a-f0-9]+/);
  });

  it('handleCallback rejeita params ausentes', async () => {
    const svc = new GoogleMeetOAuthService(mkPrisma());
    await expect(svc.handleCallback(undefined, undefined)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('handleCallback rejeita state inexistente/expirado/usado', async () => {
    const prisma = mkPrisma();
    prisma.googleMeetOauthState.findUnique.mockResolvedValue(null);
    const svc = new GoogleMeetOAuthService(prisma);
    await expect(svc.handleCallback('code', 'state')).rejects.toThrow(
      BadRequestException,
    );

    prisma.googleMeetOauthState.findUnique.mockResolvedValue({
      id: 's1',
      admin_id: 'a1',
      state: 'state',
      used_at: new Date(),
      expires_at: new Date(Date.now() + 60000),
    });
    await expect(svc.handleCallback('code', 'state')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('getAccessToken lança quando não há conexão ativa', async () => {
    const prisma = mkPrisma();
    prisma.googleMeetConnection.findFirst.mockResolvedValue(null);
    const svc = new GoogleMeetOAuthService(prisma);
    await expect(svc.getAccessToken()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('encrypt/decrypt faz round-trip do token', () => {
    const svc = new GoogleMeetOAuthService(mkPrisma()) as any;
    const original = 'refresh-token-secreto-1//abc';
    const encrypted = svc.encryptToken(original);
    expect(encrypted.startsWith('v1:')).toBe(true);
    expect(encrypted).not.toContain(original);
    expect(svc.decryptToken(encrypted)).toBe(original);
  });
});
