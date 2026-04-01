// ABAP AI Studio — Cloudflare Worker API Gateway
// Handles: user auth, Claude API proxy, SAP request forwarding

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function err(message, status = 400) {
  return json({ error: message }, status);
}

// Simple JWT-like token (HMAC-SHA256 based)
async function signToken(payload, secret) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify({ ...payload, exp: Date.now() + 86400000 }));
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${header}.${body}`));
  return `${header}.${body}.${btoa(String.fromCharCode(...new Uint8Array(sig)))}`;
}

async function verifyToken(token, secret) {
  try {
    const [header, body, sig] = token.split('.');
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sigBytes = Uint8Array.from(atob(sig), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(`${header}.${body}`));
    if (!valid) return null;
    const payload = JSON.parse(atob(body));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

async function hashPassword(password) {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(password + 'abap-studio-salt-2026'));
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

// Extract user from Authorization header
async function getUser(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyToken(auth.slice(7), env.JWT_SECRET);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ── Public routes ──────────────────────────────
      if (path === '/health') {
        return json({ status: 'ok', service: 'abap-ai-studio', version: '1.0.0' });
      }

      if (path === '/auth/register' && request.method === 'POST') {
        return handleRegister(request, env);
      }

      if (path === '/auth/login' && request.method === 'POST') {
        return handleLogin(request, env);
      }

      // ── Protected routes ───────────────────────────
      const user = await getUser(request, env);
      if (!user) return err('Unauthorized — please login', 401);

      if (path === '/auth/me') {
        return json({ user });
      }

      if (path === '/auth/update-sap' && request.method === 'POST') {
        return handleUpdateSap(request, env, user);
      }

      // Claude AI proxy
      if (path === '/claude' && request.method === 'POST') {
        return handleClaude(request, env, user);
      }

      // SAP proxy routes — forward to Azure backend
      if (path.startsWith('/sap/')) {
        return handleSapProxy(request, env, user, path);
      }

      // Admin routes
      if (path === '/admin/users' && user.role === 'admin') {
        return handleListUsers(env);
      }

      if (path === '/admin/audit' && user.role === 'admin') {
        return handleAuditLog(env);
      }

      return err('Not found', 404);
    } catch (e) {
      return err(`Internal error: ${e.message}`, 500);
    }
  },
};

// ── Auth handlers ─────────────────────────────────────

async function handleRegister(request, env) {
  const { username, password, display_name } = await request.json();
  if (!username || !password) return err('Username and password required');
  if (username.length < 3) return err('Username must be at least 3 characters');
  if (password.length < 6) return err('Password must be at least 6 characters');

  const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
  if (existing) return err('Username already taken');

  const pwHash = await hashPassword(password);
  const result = await env.DB.prepare(
    'INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)'
  ).bind(username, pwHash, display_name || username, 'developer').run();

  await auditLog(env, result.meta.last_row_id, 'register', `New user registered: ${username}`);

  const token = await signToken({ id: result.meta.last_row_id, username, role: 'developer', display_name: display_name || username }, env.JWT_SECRET);
  return json({ token, user: { id: result.meta.last_row_id, username, role: 'developer', display_name: display_name || username } });
}

async function handleLogin(request, env) {
  const { username, password } = await request.json();
  if (!username || !password) return err('Username and password required');

  const user = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
  if (!user) return err('Invalid credentials', 401);

  const pwHash = await hashPassword(password);
  if (user.password_hash !== pwHash) return err('Invalid credentials', 401);

  await env.DB.prepare('UPDATE users SET last_login = datetime(\'now\') WHERE id = ?').bind(user.id).run();
  await auditLog(env, user.id, 'login', `User logged in: ${username}`);

  const token = await signToken({
    id: user.id, username: user.username, role: user.role,
    display_name: user.display_name, sap_user: user.sap_user
  }, env.JWT_SECRET);

  return json({
    token,
    user: { id: user.id, username: user.username, role: user.role, display_name: user.display_name, sap_user: user.sap_user }
  });
}

async function handleUpdateSap(request, env, user) {
  const { sap_user, sap_password } = await request.json();
  if (!sap_user || !sap_password) return err('SAP user and password required');

  // Encrypt SAP password with a simple XOR (in production use proper encryption)
  const enc = btoa(sap_password);
  await env.DB.prepare('UPDATE users SET sap_user = ?, sap_password_enc = ? WHERE id = ?')
    .bind(sap_user, enc, user.id).run();

  await auditLog(env, user.id, 'update_sap', `SAP credentials updated for ${user.username}`);
  return json({ success: true });
}

// ── Claude AI Proxy ──────────────────────────────────

async function handleClaude(request, env, user) {
  const body = await request.json();
  await auditLog(env, user.id, 'claude_call', `Model: ${body.model}, tokens: ${body.max_tokens}`);

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': env.ANTHROPIC_KEY,
    },
    body: JSON.stringify({
      model: body.model || 'claude-sonnet-4-20250514',
      max_tokens: Math.min(body.max_tokens || 4096, 8192),
      system: body.system || undefined,
      messages: body.messages,
    }),
  });

  const data = await resp.json();
  return json(data);
}

// ── SAP Proxy (forward to Azure backend) ─────────────

async function handleSapProxy(request, env, user, path) {
  // Get user's SAP credentials
  const dbUser = await env.DB.prepare('SELECT sap_user, sap_password_enc FROM users WHERE id = ?')
    .bind(user.id).first();

  if (!dbUser?.sap_user) return err('SAP credentials not configured. Update via /auth/update-sap', 400);

  const sapPassword = atob(dbUser.sap_password_enc);
  const sapPath = path.replace('/sap/', '/');

  // Forward to Azure backend
  const azureUrl = `${env.AZURE_BACKEND_URL}${sapPath}`;

  let body = null;
  if (request.method === 'POST') {
    const reqBody = await request.json();
    body = JSON.stringify({ ...reqBody, hana_user: dbUser.sap_user, hana_password: sapPassword });
  }

  await auditLog(env, user.id, 'sap_call', `${request.method} ${sapPath}`);

  const resp = await fetch(azureUrl, {
    method: request.method,
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  const data = await resp.json();
  return json(data, resp.status);
}

// ── Admin ────────────────────────────────────────────

async function handleListUsers(env) {
  const users = await env.DB.prepare(
    'SELECT id, username, display_name, role, sap_user, created_at, last_login FROM users ORDER BY id'
  ).all();
  return json({ users: users.results });
}

async function handleAuditLog(env) {
  const logs = await env.DB.prepare(
    'SELECT a.*, u.username FROM audit_log a LEFT JOIN users u ON a.user_id = u.id ORDER BY a.id DESC LIMIT 100'
  ).all();
  return json({ logs: logs.results });
}

// ── Audit logging ────────────────────────────────────

async function auditLog(env, userId, action, detail) {
  try {
    await env.DB.prepare('INSERT INTO audit_log (user_id, action, detail) VALUES (?, ?, ?)')
      .bind(userId, action, detail).run();
  } catch (e) {
    console.error('Audit log error:', e);
  }
}
