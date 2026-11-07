import type { IncomingMessage } from 'node:http';
import { AppError } from '@scalesquad/shared';
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text, (key: string, value: unknown) => {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Forbidden key');
      return value;
    }) as unknown;
  } catch {
    throw new AppError('VALIDATION', 400, 'Invalid JSON');
  }
}
export async function bodyParser(req: IncomingMessage, maxBytes = 16384): Promise<unknown> {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json')
    throw new AppError('VALIDATION', 415, 'JSON content type required');
  if (Number(req.headers['content-length']) > maxBytes)
    throw new AppError('VALIDATION', 413, 'Body too large');
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const raw of req) {
    const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as Uint8Array);
    bytes += chunk.length;
    if (bytes > maxBytes) throw new AppError('VALIDATION', 413, 'Body too large');
    chunks.push(chunk);
  }
  return parseJson(Buffer.concat(chunks).toString('utf8'));
}
