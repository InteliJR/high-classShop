import { ServiceUnavailableException } from '@nestjs/common';
import { MeetingsService } from './meetings.service';

function mkProcess(overrides: any = {}) {
  return {
    id: 'proc-1',
    client_id: 'client-1',
    specialist_id: 'spec-1',
    status: 'SCHEDULING',
    meeting_session: null,
    client: {
      id: 'client-1',
      email: 'cliente@externo.com',
      name: 'Cliente',
      surname: 'Teste',
      consultant_id: null,
      consultant: null,
    },
    specialist: {
      id: 'spec-1',
      email: 'spec@empresa.com',
      name: 'Espec',
      surname: 'Ialista',
    },
    ...overrides,
  };
}

function mkPrisma(process: any) {
  return {
    process: { findUnique: jest.fn().mockResolvedValue(process) },
    meetingSession: {
      create: jest.fn().mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: 'meet-1',
          process_id: data.process_id,
          meet_link: data.meet_link,
          started_at: data.started_at,
          ended_at: null,
        }),
      ),
    },
  } as any;
}

function mkConfig(accessType = 'OPEN') {
  return {
    get: jest.fn((key: string, def?: string) => {
      if (key === 'GOOGLE_MEET_ACCESS_TYPE') return accessType;
      if (key === 'MEETING_PROVIDER') return 'GOOGLE';
      if (key === 'MEETING_DEMO_FALLBACK_ENABLED') return 'false';
      return def;
    }),
  } as any;
}

const notification = {
  sendMeetingStartedEmail: jest.fn().mockResolvedValue({}),
  sendMeetingAdvancedEmail: jest.fn().mockResolvedValue({}),
} as any;

describe('MeetingsService — criação via Meet REST API', () => {
  afterEach(() => jest.restoreAllMocks());

  it('cria sala Meet com accessType OPEN e grava meet_link + spaceName', async () => {
    const process = mkProcess();
    const prisma = mkPrisma(process);
    const oauth = {
      getAccessToken: jest.fn().mockResolvedValue('access-token'),
    } as any;

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        name: 'spaces/abc123',
        meetingUri: 'https://meet.google.com/abc-defg-hij',
      }),
    });
    global.fetch = fetchMock as any;

    const svc = new MeetingsService(
      prisma,
      mkConfig('OPEN'),
      notification,
      oauth,
    );
    const result = await svc.startMeetingForProcess('proc-1', 'spec-1');

    // accessType OPEN enviado no body
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.config.accessType).toBe('OPEN');
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://meet.googleapis.com/v2/spaces',
    );

    expect(result.meet_link).toBe('https://meet.google.com/abc-defg-hij');
    expect(prisma.meetingSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          calendar_event_id: 'spaces/abc123',
          meet_link: 'https://meet.google.com/abc-defg-hij',
        }),
      }),
    );
  });

  it('sem conexão ativa → ServiceUnavailableException (sem fallback)', async () => {
    const process = mkProcess();
    const prisma = mkPrisma(process);
    const oauth = {
      getAccessToken: jest
        .fn()
        .mockRejectedValue(new ServiceUnavailableException('não conectado')),
    } as any;

    const svc = new MeetingsService(
      prisma,
      mkConfig('OPEN'),
      notification,
      oauth,
    );
    await expect(
      svc.startMeetingForProcess('proc-1', 'spec-1'),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('só o especialista pode iniciar a reunião', async () => {
    const process = mkProcess();
    const prisma = mkPrisma(process);
    const oauth = { getAccessToken: jest.fn() } as any;

    const svc = new MeetingsService(
      prisma,
      mkConfig('OPEN'),
      notification,
      oauth,
    );
    // cliente tentando iniciar
    await expect(
      svc.startMeetingForProcess('proc-1', 'client-1'),
    ).rejects.toThrow(/especialista/i);
  });
});
