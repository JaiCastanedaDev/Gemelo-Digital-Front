import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, ContractDriftError } from './errors';
import { buildUrl, createHttpClient, type HttpClientOptions } from './http';

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

const okSchema = z.object({ ok: z.boolean() });

function setup(responses: Response[], overrides: Partial<HttpClientOptions> = {}) {
  let token = 'token-1';
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    const next = responses.shift();
    if (!next) throw new Error('sin respuesta preparada');
    return next;
  });
  const refreshAccessToken = vi.fn(async () => {
    token = 'token-2';
    return true;
  });
  const client = createHttpClient({
    baseUrl: 'http://api.test',
    getAccessToken: () => token,
    refreshAccessToken,
    validation: 'strict',
    fetch: fetchMock as unknown as typeof fetch,
    ...overrides,
  });
  const authHeader = (call: number) =>
    (fetchMock.mock.calls[call]?.[1]?.headers as Record<string, string> | undefined)?.Authorization;
  return { client, fetchMock, refreshAccessToken, authHeader };
}

describe('buildUrl', () => {
  it('antepone /api/v1 y omite parámetros vacíos', () => {
    expect(buildUrl('http://api.test', '/alerts', { level: 'CRITICAL', acknowledged: false, x: null, y: undefined, z: '' })).toBe(
      'http://api.test/api/v1/alerts?level=CRITICAL&acknowledged=false',
    );
  });
});

describe('createHttpClient', () => {
  it('envía el Bearer y valida la respuesta', async () => {
    const { client, authHeader } = setup([json(200, { ok: true })]);
    await expect(client.get('/x', { schema: okSchema })).resolves.toEqual({ ok: true });
    expect(authHeader(0)).toBe('Bearer token-1');
  });

  it('ante 401 renueva el token y reintenta una vez', async () => {
    const { client, refreshAccessToken, authHeader } = setup([json(401, {}), json(200, { ok: true })]);
    await expect(client.get('/x', { schema: okSchema })).resolves.toEqual({ ok: true });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(authHeader(1)).toBe('Bearer token-2');
  });

  it('no entra en bucle: un segundo 401 se propaga', async () => {
    const { client, refreshAccessToken } = setup([json(401, {}), json(401, {})]);
    await expect(client.get('/x', { schema: okSchema })).rejects.toMatchObject({ status: 401 });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('si el refresh falla espera la re-autenticación y reintenta', async () => {
    const waitForReauth = vi.fn(async () => true);
    const { client } = setup([json(401, {}), json(200, { ok: true })], {
      refreshAccessToken: async () => false,
      waitForReauth,
    });
    await expect(client.get('/x', { schema: okSchema })).resolves.toEqual({ ok: true });
    expect(waitForReauth).toHaveBeenCalledTimes(1);
  });

  it('si no hay re-autenticación propaga el 401', async () => {
    const { client } = setup([json(401, { error: { code: 'TOKEN_EXPIRED', message: 'expiró' } })], {
      refreshAccessToken: async () => false,
      waitForReauth: async () => false,
    });
    await expect(client.get('/x', { schema: okSchema })).rejects.toMatchObject({ status: 401, code: 'TOKEN_EXPIRED' });
  });

  it('convierte 422 en ApiError con errores por campo', async () => {
    const { client } = setup([
      json(422, { error: { code: 'VALIDATION_ERROR', message: 'x', details: [{ path: 'description', message: 'corta' }] } }),
    ]);
    const err = await client.post('/maintenance', { schema: okSchema, body: { description: 'a' } }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).fieldErrors).toEqual([{ path: 'description', message: 'corta' }]);
  });

  it('envía el cuerpo como JSON en POST', async () => {
    const { client, fetchMock } = setup([json(200, { ok: true })]);
    await client.post('/x', { schema: okSchema, body: { a: 1 } });
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"a":1}');
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('modo strict: una respuesta fuera de contrato lanza ContractDriftError y la reporta', async () => {
    const onContractDrift = vi.fn();
    const { client } = setup([json(200, { ok: 'sí' })], { onContractDrift });
    await expect(client.get('/x', { schema: okSchema })).rejects.toBeInstanceOf(ContractDriftError);
    expect(onContractDrift).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET', path: '/x' }));
  });

  it('modo lenient: reporta la deriva pero devuelve los datos', async () => {
    const onContractDrift = vi.fn();
    const { client } = setup([json(200, { ok: 'sí' })], { validation: 'lenient', onContractDrift });
    await expect(client.get('/x', { schema: okSchema })).resolves.toEqual({ ok: 'sí' });
    expect(onContractDrift).toHaveBeenCalledTimes(1);
  });

  it('un fallo de red se convierte en ApiError status 0', async () => {
    const client = createHttpClient({
      baseUrl: '',
      getAccessToken: () => null,
      refreshAccessToken: async () => false,
      validation: 'strict',
      fetch: (async () => {
        throw new TypeError('Failed to fetch');
      }) as unknown as typeof fetch,
    });
    await expect(client.get('/x', { schema: okSchema })).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('getBlob devuelve el binario', async () => {
    const { client } = setup([new Response('%PDF', { status: 200, headers: { 'Content-Type': 'application/pdf' } })]);
    const blob = await client.getBlob('/reports/structural_health');
    expect(await blob.text()).toBe('%PDF');
  });
});
