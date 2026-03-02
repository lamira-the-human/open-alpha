import { executeSql } from '../_lib/db.js';

// TODO: Set ATXP_AUTHORIZATION_ENDPOINT once ATXP eng team provides the registered OAuth app.
// Expected value: something like 'https://accounts.atxp.ai/oauth/authorize'
// Required env vars: ATXP_CLIENT_ID, ATXP_AUTHORIZATION_ENDPOINT
const ATXP_AUTHORIZATION_ENDPOINT = process.env.ATXP_AUTHORIZATION_ENDPOINT;
const ATXP_CLIENT_ID = process.env.ATXP_CLIENT_ID;

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
    if (!ATXP_AUTHORIZATION_ENDPOINT || !ATXP_CLIENT_ID) {
      return Response.json(
        { error: 'ATXP OAuth not yet configured. Set ATXP_AUTHORIZATION_ENDPOINT and ATXP_CLIENT_ID env vars.' },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({})) as {
      role?: 'student' | 'parent';
      gradeLevel?: number;
    };

    const { codeVerifier, codeChallenge } = await generatePKCE();
    const state = generateState();

    // Store PKCE state + signup context for the callback
    await executeSql(
      'INSERT INTO oauth_pkce (state, code_verifier, role, grade_level) VALUES ($1, $2, $3, $4)',
      [state, codeVerifier, body.role ?? null, body.gradeLevel ?? null]
    );

    const callbackUrl = new URL('/auth/callback', request.url).toString()
      .replace(/^http:\/\/localhost/, 'http://localhost'); // preserve local dev

    const authUrl = new URL(ATXP_AUTHORIZATION_ENDPOINT);
    authUrl.searchParams.set('client_id', ATXP_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', callbackUrl);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('scope', 'openid profile');

    return Response.json({ authorizationUrl: authUrl.toString() });
  } catch (error) {
    console.error('ATXP initiate error:', error);
    return Response.json({ error: 'Failed to initiate authentication' }, { status: 500 });
  }
}
