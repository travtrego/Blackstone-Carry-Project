export function GET() {
  return Response.json({ ready: Boolean(process.env.ANTHROPIC_API_KEY), service: 'blackstone-carry' }, { headers: { 'Cache-Control': 'no-store' } });
}
