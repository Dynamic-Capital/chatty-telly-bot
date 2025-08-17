const base = process.env.FUNCTIONS_BASE || (process.env.SUPABASE_PROJECT_REF ? `https://${process.env.SUPABASE_PROJECT_REF}.functions.supabase.co` : null);
if (!base) {
  console.error('Set FUNCTIONS_BASE or SUPABASE_PROJECT_REF.');
  process.exit(1);
}

async function check(method, path, expected, init = {}) {
  try {
    const res = await fetch(base + path, { method, ...init });
    if (res.status !== expected) {
      console.error(`[!] ${method} ${path} expected ${expected} got ${res.status}`);
      return false;
    }
    console.log(`[OK] ${method} ${path} -> ${res.status}`);
    return true;
  } catch (err) {
    console.error(`[ERR] ${method} ${path} -> ${err.message}`);
    return false;
  }
}

const results = await Promise.all([
  check('GET', '/telegram-bot/version', 200),
  check('POST', '/telegram-bot', 401, {
    headers: { 'content-type': 'application/json' },
    body: '{}',
  }),
  check('GET', '/miniapp/version', 200),
  check('HEAD', '/miniapp', 200),
]);

if (results.includes(false)) {
  process.exit(1);
}
