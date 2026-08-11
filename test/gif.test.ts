import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchActionGif } from '../src/services/gif.service';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchActionGif', () => {
  it('returns the first result url', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ results: [{ url: 'https://nekos.best/x.gif' }] }), {
        status: 200,
      }),
    );
    await expect(fetchActionGif('hug')).resolves.toBe('https://nekos.best/x.gif');
  });

  it('fails open to null on HTTP errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 500 }));
    await expect(fetchActionGif('hug')).resolves.toBeNull();
  });

  it('fails open to null on network errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('timeout'));
    await expect(fetchActionGif('hug')).resolves.toBeNull();
  });

  it('fails open to null on malformed payloads', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ unexpected: true }), { status: 200 }),
    );
    await expect(fetchActionGif('hug')).resolves.toBeNull();
  });
});
