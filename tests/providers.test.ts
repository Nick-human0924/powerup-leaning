import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiError, compatibleProvider, ProviderError, structureInput } from '../src/lib/providers';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('provider API privacy and schema guards', () => {
  it('returns setup-required 503 with no upstream request when key is absent', async () => {
    vi.stubEnv('AI_API_KEY', ''); vi.stubEnv('STRUCTURING_MODEL', 'test-model');
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    let thrown: unknown;
    try { await compatibleProvider.structure({ kind: 'feedback', text: 'banana', skills: [{ id: 'banana', title: 'banana' }], consent: true }); } catch (error) { thrown = error; }
    const response = apiError(thrown);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: expect.stringMatching(/尚未配置/) });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects malformed input and missing consent before any external call', async () => {
    vi.stubEnv('AI_API_KEY', 'secret-test-key'); vi.stubEnv('STRUCTURING_MODEL', 'test-model');
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    expect(structureInput.safeParse({ kind: 'feedback', text: 'hello', consent: false }).success).toBe(false);
    expect(structureInput.safeParse({ kind: 'answer', text: 'hello' }).success).toBe(false);
    const oversizedImage = structureInput.safeParse({ kind: 'material', consent: true, image: `data:image/png;base64,${'A'.repeat(8_000_001)}` });
    expect(oversizedImage.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps provider setup failures to an explicit 503 response', async () => {
    const response = apiError(new ProviderError('AI服务尚未配置，请使用人工核对模式'));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: expect.stringMatching(/尚未配置/) });
  });

  it('uses a mocked compatible adapter and validates source-grounded candidate output', async () => {
    vi.stubEnv('AI_API_KEY', 'secret-test-key'); vi.stubEnv('AI_BASE_URL', 'https://provider.test/v1'); vi.stubEnv('STRUCTURING_MODEL', 'test-model');
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ candidates: [{ skill_id: 'banana-skill', outcome_suggestion: 'independent', source_phrase: 'banana 完全不用提示', confidence: 0.92 }] }) } }] }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await compatibleProvider.structure({ kind: 'feedback', text: 'banana 完全不用提示', consent: true, skills: [{ id: 'banana-skill', title: 'banana' }] });
    expect(result).toEqual({ candidates: [{ skill_id: 'banana-skill', outcome_suggestion: 'independent', source_phrase: 'banana 完全不用提示', confidence: 0.92 }] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer secret-test-key');
    expect(JSON.stringify(init?.body)).toContain('banana 完全不用提示');
  });

  it('rejects fabricated phrases and unknown skill ids returned by the provider', async () => {
    vi.stubEnv('AI_API_KEY', 'secret-test-key'); vi.stubEnv('AI_BASE_URL', 'https://provider.test/v1'); vi.stubEnv('STRUCTURING_MODEL', 'test-model');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ candidates: [{ skill_id: 'invented', outcome_suggestion: 'independent', source_phrase: 'a phrase absent from the note', confidence: 1 }] }) } }] }), { status: 200 })));
    await expect(compatibleProvider.structure({ kind: 'feedback', text: 'banana was easy', consent: true, skills: [{ id: 'banana-skill', title: 'banana' }] })).rejects.toThrow(/candidate|候选/);
  });

  it('rejects a structurally invalid model result even after a successful mock response', async () => {
    vi.stubEnv('AI_API_KEY', 'secret-test-key'); vi.stubEnv('AI_BASE_URL', 'https://provider.test/v1'); vi.stubEnv('STRUCTURING_MODEL', 'test-model');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ candidates: [{ skill_id: 'banana-skill', outcome_suggestion: 'pass', source_phrase: 'banana', confidence: 1 }] }) } }] }), { status: 200 })));
    await expect(compatibleProvider.structure({ kind: 'feedback', text: 'banana', consent: true, skills: [{ id: 'banana-skill', title: 'banana' }] })).rejects.toThrow();
  });
});
