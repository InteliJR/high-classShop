import { ProcessStatus } from '@prisma/client';

export type ProcessesByStatus = Record<ProcessStatus, number>;
export type ProcessSummary = { by_status: ProcessesByStatus };
