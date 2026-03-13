import { executeSql } from '../_lib/db.js';
import { signToken } from '../_lib/auth.js';

const ATXP_ISSUER = process.env.ATXP_ISSUER ?? 'https://auth.atxp.ai';
const ATXP_CLIENT_ID = process.env.ATXP_CLIENT_ID;
const ATXP_CLIENT_SECRET = process.env.ATXP_CLIENT_SECRET;

interface OIDCConfig {
  token_endpoint: string;
}

let oidcConfig: OIDCConfig | null = null;

async function getOIDCConfig(): Promise<OIDCConfig> {
  if (oidcConfig) return oidcConfig;
  const res = await fetch(`${ATXP_ISSUER}/.well-known/openid-configuration`);
  if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`);
  oidcConfig = await res.json() as OIDCConfig;
  return oidcConfig;
}

function parseIdTokenClaims(idToken: string): Record<string, unknown> {
  const parts = idToken.split('.');
  if (parts.length < 2) return {};
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload));
  } catch {
    return {};
  }
}

interface UserRow {
  id: number;
  email: string;
  display_name: string | null;
  role: 'student' | 'parent';
  grade_level: number | null;
  atxp_account_id: string | null;
}

interface PKCERow {
  code_verifier: string;
  role: string | null;
  grade_level: number | null;
}

export async function GET(request: Request) {
  try {
    if (!ATXP_CLIENT_ID || !ATXP_CLIENT_SECRET) {
      return Response.json(
        { error: 'ATXP OAuth not configured. Set ATXP_CLIENT_ID and ATXP_CLIENT_SECRET env vars.' },
        { status: 503 }
      );
    }

    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const errorParam = url.searchParams.get('error');

    if (errorParam) {
      return Response.json({ error: `ATXP auth error: ${errorParam}` }, { status: 400 });
    }

    if (!code || !state) {
      return Response.json({ error: 'Missing code or state' }, { status: 400 });
    }

    const pkceResult = await executeSql<PKCERow>(
      'SELECT code_verifier, role, grade_level FROM oauth_pkce WHERE state = $1',
      [state]
    );

    if (pkceResult.rows.length === 0) {
      return Response.json({ error: 'Invalid or expired state' }, { status: 400 });
    }

    const { code_verifier, role, grade_level } = pkceResult.rows[0];
    await executeSql('DELETE FROM oauth_pkce WHERE state = $1', [state]);

    const callbackUrl = new URL('/auth/callback', request.url).toString()
      .replace(/^http:\/\/localhost/, 'http://localhost');

    const { token_endpoint } = await getOIDCConfig();

    const tokenRes = await fetch(token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUrl,
        client_id: ATXP_CLIENT_ID,
        client_secret: ATXP_CLIENT_SECRET,
        code_verifier,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('Token exchange failed:', err);
      return Response.json({ error: 'Token exchange failed', detail: err }, { status: 401 });
    }

    const tokenData = await tokenRes.json() as { access_token: string; id_token?: string };

    // Extract claims from id_token (avoids a separate userinfo round-trip)
    const claims = tokenData.id_token ? parseIdTokenClaims(tokenData.id_token) : {};
    const atxpAccountId = claims.sub as string | undefined;
    const connectionToken = claims.atxp_connection_token as string | undefined;
    const displayName = (claims.name ?? null) as string | null;
    const email = (claims.email as string | undefined) ?? (atxpAccountId ? `atxp:${atxpAccountId}` : null);

    if (!atxpAccountId) {
      return Response.json({ error: 'No account identifier in token response' }, { status: 401 });
    }

    const existingUser = await executeSql<UserRow>(
      'SELECT id, email, display_name, role, grade_level, atxp_account_id FROM users WHERE atxp_account_id = $1',
      [atxpAccountId]
    );

    let user: UserRow;

    if (existingUser.rows.length > 0) {
      user = existingUser.rows[0];
      if (connectionToken) {
        await executeSql(
          'UPDATE users SET atxp_connection_token = $1 WHERE id = $2',
          [connectionToken, user.id]
        );
      }
    } else {
      if (!role) {
        return Response.json(
          { error: 'no_account', message: 'No Open Alpha account found. Please sign up first.' },
          { status: 404 }
        );
      }

      await executeSql(
        'INSERT INTO users (email, atxp_account_id, display_name, role, grade_level, atxp_connection_token) VALUES ($1, $2, $3, $4, $5, $6)',
        [email, atxpAccountId, displayName, role, grade_level ?? null, connectionToken ?? null]
      );

      const newUser = await executeSql<UserRow>(
        'SELECT id, email, display_name, role, grade_level, atxp_account_id FROM users WHERE atxp_account_id = $1',
        [atxpAccountId]
      );
      user = newUser.rows[0];
    }

    const token = signToken({ userId: user.id, role: user.role });

    return Response.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role,
        gradeLevel: user.grade_level,
      },
    });
  } catch (error) {
    console.error('ATXP callback error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: 'Authentication failed', detail: message }, { status: 500 });
  }
}
