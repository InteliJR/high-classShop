import { ProviderStatus } from '@prisma/client';

export function mapDocusignStatusToProviderStatus(
  status: string,
): ProviderStatus {
  switch (status) {
    case 'created':
      return ProviderStatus.CREATED;
    case 'sent':
      return ProviderStatus.SENT;
    case 'delivered':
      return ProviderStatus.DELIVERED;
    case 'completed':
      return ProviderStatus.COMPLETED;
    case 'declined':
      return ProviderStatus.DECLINED;
    case 'voided':
      return ProviderStatus.VOIDED;
    case 'timeout':
      return ProviderStatus.TIMEDOUT;
    default:
      return ProviderStatus.ERROR;
  }
}
