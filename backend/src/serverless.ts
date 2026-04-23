import type { IncomingMessage, ServerResponse } from 'http';
import type { Express } from 'express';
import { createApp } from './main';

let cachedServer: Express | null = null;

async function getServer(): Promise<Express> {
  if (!cachedServer) {
    cachedServer = await createApp();
  }
  return cachedServer;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  const server = await getServer();
  server(req as any, res as any);
}
