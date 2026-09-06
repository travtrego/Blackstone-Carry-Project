const URL_MESSAGES = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-5';
const MAX_BODY_BYTES = 120_000;
let busy = false;
function error(message: string, status: number) {
  return Response.json({ error: { message } }, { status, headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(request: Request) {
  // This unauthenticated learning app is local-only. Deployment needs real auth.
  const url = new URL(request.url);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return error('This API is local-only. Authentication is required before public hosting.', 403);
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) return error('Cross-origin requests are not allowed.', 403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return error('Expected JSON.', 415);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return error('Add ANTHROPIC_API_KEY to .env.local and restart the tool.', 503);
  let input;
  try {
    if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) return error('Request is too large.', 413);
    const reader = request.body?.getReader();
    if (!reader) return error('Request body is missing.', 400);
    const decoder = new TextDecoder();
    let raw = '', size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); return error('Request is too large.', 413); }
      raw += decoder.decode(value, { stream: true });
    }
    input = JSON.parse(raw + decoder.decode());
  } catch { return error('Request body must be valid JSON.', 400); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return error('Expected a JSON object.', 400);
  if (typeof input.system !== 'string' || !input.system.trim() || input.system.length > 12000) return error('System instructions are missing or too large.', 400);
  if (typeof input.prompt !== 'string' || !input.prompt.trim() || input.prompt.length > 100000) return error('Prompt is missing or too large.', 400);
  const search = input.tools !== undefined;
  if (search && (!Array.isArray(input.tools) || input.tools.length !== 1 || input.tools[0]?.type !== 'web_search_20250305' || input.tools[0]?.name !== 'web_search')) return error('Unsupported tool configuration. Refresh the page.', 400);
  if (busy) return error('Another AI request is still finishing. Wait a moment before retrying.', 429);
  if (request.signal.aborted) return error('Request cancelled.', 499);
  busy = true;
  const started = Date.now();
  const timeoutMs = search ? 90000 : 60000;
  const controller = new AbortController();
  const abort = () => controller.abort();
  request.signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, timeoutMs);
  let status = 500;
  console.info('[claude] started', { kind: search ? 'retrieval' : 'analysis' });
  try {
    const headers: Record<string, string> = { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
    if (process.env.ANTHROPIC_WORKSPACE_ID) headers['anthropic-workspace-id'] = process.env.ANTHROPIC_WORKSPACE_ID;
    const body: Record<string, unknown> = {
      model: MODEL, max_tokens: 4000, thinking: { type: 'disabled' },
      system: input.system, messages: [{ role: 'user', content: input.prompt }],
    };
    // Server-owned cost/domain limits cannot be overridden by the browser.
    if (search) body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2, allowed_domains: ['sec.gov', 'blackstone.com'] }];
    const response = await fetch(URL_MESSAGES, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
    const data = await response.json();
    status = response.status;
    return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    status = request.signal.aborted ? 499 : controller.signal.aborted ? 504 : 502;
    return error(status === 499 ? 'Request cancelled.' : status === 504 ?
      'Claude exceeded this stage’s ' + timeoutMs / 1000 + '-second deadline. No automatic retry was made.' :
      'Could not reach Anthropic. Check internet access, then retry this stage.', status);
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', abort);
    busy = false;
    console.info('[claude] finished', { status, elapsedMs: Date.now() - started });
  }
}
