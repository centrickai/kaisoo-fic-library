// Public endpoint for comparing a visitor-entered PIN with a server-side secret.
// This is NOT authorization for the public Supabase database or Storage bucket.
const allowedOrigins = (Deno.env.get('FIC_SHELF_ALLOWED_ORIGINS') || '')
  .split(',').map(v => v.trim()).filter(Boolean);

function cors(origin: string | null): Headers {
  const h = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin' });
  if (origin && allowedOrigins.includes(origin)) h.set('Access-Control-Allow-Origin', origin);
  h.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'Content-Type');
  return h;
}

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const headers = cors(origin);
  if (!origin || !allowedOrigins.includes(origin)) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), { status: 403, headers });
  }
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  const expected = Deno.env.get('FIC_SHELF_PIN');
  if (!expected || !/^\d{4}$/.test(expected)) {
    return new Response(JSON.stringify({ error: 'PIN service not configured' }), { status: 503, headers });
  }
  // Small bounded request; reject any unexpected payload.
  const raw = await req.text();
  if (raw.length > 256) return new Response(JSON.stringify({ valid: false }), { status: 400, headers });
  let pin: unknown;
  try { pin = JSON.parse(raw)?.pin; } catch { /* invalid JSON */ }
  if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
    return new Response(JSON.stringify({ valid: false }), { status: 400, headers });
  }
  // Constant-time-ish comparison over exactly four ASCII digits.
  let difference = 0;
  for (let i = 0; i < 4; i++) difference |= pin.charCodeAt(i) ^ expected.charCodeAt(i);
  return new Response(JSON.stringify({ valid: difference === 0 }), { status: 200, headers });
});
