export const MEETING_INITIALIZATION_PREFIX = 'meeting-init:';
export const MEETING_READY_PREFIX = 'meeting-ready:';
export const MEETING_INITIALIZATION_TTL_MS = 2 * 60 * 1000;

type MeetingClaim = {
  calendar_event_id?: string | null;
  started_at?: Date | null;
};

export type ReadyMeetingClaim = {
  claimId: string;
  provider: 'JITSI' | 'GOOGLE' | 'DEMO';
  calendarEventId: string;
};

export function isMeetingInitializationClaim(
  meeting: MeetingClaim | null | undefined,
): boolean {
  return Boolean(
    meeting?.calendar_event_id?.startsWith(MEETING_INITIALIZATION_PREFIX),
  );
}

export function isStaleMeetingInitializationClaim(
  meeting: MeetingClaim | null | undefined,
  now = Date.now(),
): boolean {
  if (!isMeetingInitializationClaim(meeting) || !meeting?.started_at) {
    return false;
  }
  const startedAt = meeting.started_at.getTime();
  return (
    Number.isFinite(startedAt) &&
    now - startedAt >= MEETING_INITIALIZATION_TTL_MS
  );
}

export function parseReadyMeetingClaim(
  meeting: MeetingClaim | null | undefined,
): ReadyMeetingClaim | null {
  const value = meeting?.calendar_event_id;
  if (typeof value !== 'string' || !value.startsWith(MEETING_READY_PREFIX)) {
    return null;
  }
  const [claimId, provider, encodedCalendarEventId] = value
    .slice(MEETING_READY_PREFIX.length)
    .split(':', 3);
  if (
    !claimId ||
    !encodedCalendarEventId ||
    !['JITSI', 'GOOGLE', 'DEMO'].includes(provider)
  ) {
    return null;
  }
  try {
    return {
      claimId,
      provider: provider as ReadyMeetingClaim['provider'],
      calendarEventId: decodeURIComponent(encodedCalendarEventId),
    };
  } catch {
    return null;
  }
}

export function buildReadyMeetingClaim(
  claimId: string,
  provider: ReadyMeetingClaim['provider'],
  calendarEventId: string,
): string {
  return `${MEETING_READY_PREFIX}${claimId}:${provider}:${encodeURIComponent(calendarEventId)}`;
}
