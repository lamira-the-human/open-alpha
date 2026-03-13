import { executeSql } from '../_lib/db.js';

const ATXP_ISSUER = process.env.ATXP_ISSUER ?? 'https://auth.atxp.ai';
const ATXP_CLIENT_ID = process.env.ATXP_CLIENT_ID;

// Module-level cache — survives across requests in the same function instance
let authorizationEndpoint: string | null = null;

async function getAuthorizationEndpoint(): Promise<string> {
  if (authorizationEndpoint) return authorizationEndpoint;
  const res = await fetch(`${ATXP_ISSUER}/.well-known/openid-configuration`);
  if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`);
  const config = await res.json() as { authorization_endpoint: string };
  authorizationEndpoint = config.authorization_endpoint;
  return authorizationEndpoint;
}

function base64url(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function generatePKCE() {
  const verifierBytes = new Uint8Array(32);
  crypto.getRandomValues(verifierBytes);
  const codeVerifier = base64url(verifierBytes.buffer);

  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(codeVerifier));
  const codeChallenge = base64url(hash);

  return { codeVerifier, codeChallenge };
}

function generateState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return base64url(bytes.buffer);
}

export async function POST(request: Request) {
  try {
    if (!ATXP_CLIENT_ID) {
      return Response.json(
        { error: 'ATXP OAuth not configured. Set ATXP_CLIENT_ID env var.' },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({})) as {
      role?: 'student' | 'parent';
      gradeLevel?: number;
    };

    const { codeVerifier, codeChallenge } = await generatePKCE();
    const state = generateState();

    await executeSql(
      'INSERT INTO oauth_pkce (state, code_verifier, role, grade_level) VALUES ($1, $2, $3, $4)',
      [state, codeVerifier, body.role ?? null, body.gradeLevel ?? null]
    );

    const callbackUrl = new URL('/auth/callback', request.url).toString()
      .replace(/^http:\/\/localhost/, 'http://localhost');

    const authEndpoint = await getAuthorizationEndpoint();
    const authUrl = new URL(authEndpoint);
    authUrl.searchParams.set('client_id', ATXP_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', callbackUrl);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('scope', 'openid profile email atxp.connection_token');
    authUrl.searchParams.set('tpl', 'edu');

    return Response.json({ authorizationUrl: authUrl.toString() });
  } catch (error) {
    console.error('ATXP initiate error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: 'Failed to initiate authentication', detail: message }, { status: 500 });
  }
}
