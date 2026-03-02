import { executeSql } from '../_lib/db.js';
import { signToken } from '../_lib/auth.js';

// TODO: Set these env vars once ATXP eng team provides the registered OAuth app.
// ATXP_TOKEN_ENDPOINT: e.g. 'https://accounts.atxp.ai/oauth/token'
// ATXP_USERINFO_ENDPOINT: e.g. 'https://accounts.atxp.ai/oauth/userinfo'
const ATXP_TOKEN_ENDPOINT = process.env.ATXP_TOKEN_ENDPOINT;
const ATXP_USERINFO_ENDPOINT = process.env.ATXP_USERINFO_ENDPOINT;
const ATXP_CLIENT_ID = process.env.ATXP_CLIENT_ID;

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

interface ATXPUserInfo {
  sub: string;          // stable account ID
  name?: string;        // display name
  email?: string;       // email (may not always be present)
}

export async function GET(request: Request) {
  try {
    if (!ATXP_TOKEN_ENDPOINT || !ATXP_USERINFO_ENDPOINT || !ATXP_CLIENT_ID) {
      return Response.json(
        { error: 'ATXP OAuth not yet configured.' },
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

    // Look up PKCE state
    const pkceResult = await executeSql<PKCERow>(
      'SELECT code_verifier, role, grade_level FROM oauth_pkce WHERE state = $1',
      [state]
    );

    if (pkceResult.rows.length === 0) {
      return Response.json({ error: 'Invalid or expired state' }, { status: 400 });
    }

    const { code_verifier, role, grade_level } = pkceResult.rows[0];

    // Clean up used PKCE record
    await executeSql('DELETE FROM oauth_pkce WHERE state = $1', [state]);

    // Determine redirect_uri (must match what was sent to initiate)
    const callbackUrl = new URL('/auth/callback', request.url).toString()
      .replace(/^http:\/\/localhost/, 'http://localhost');

    // Exchange code for access token
    const tokenRes = await fetch(ATXP_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUrl,
        client_id: ATXP_CLIENT_ID,
        code_verifier,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('Token exchange failed:', err);
      return Response.json({ error: 'Token exchange failed' }, { status: 401 });
    }

    const { access_token } = await tokenRes.json() as { access_token: string };

    // Fetch user info
    const userInfoRes = await fetch(ATXP_USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!userInfoRes.ok) {
      return Response.json({ error: 'Failed to fetch user info' }, { status: 401 });
    }

    const atxpUser = await userInfoRes.json() as ATXPUserInfo;
    const atxpAccountId = atxpUser.sub;

    // Find existing user by ATXP account ID
    const existingUser = await executeSql<UserRow>(
      'SELECT id, email, display_name, role, grade_level, atxp_account_id FROM users WHERE atxp_account_id = $1',
      [atxpAccountId]
    );

    let user: UserRow;

    if (existingUser.rows.length > 0) {
      // Returning user — log them in
      user = existingUser.rows[0];
    } else {
      // New user — requires role from the signup flow
      if (!role) {
        return Response.json(
          { error: 'no_account', message: 'No Open Alpha account found for this ATXP account. Please sign up first.' },
          { status: 404 }
        );
      }

      // Create new user
      const email = atxpUser.email ?? `atxp:${atxpAccountId}`;
      const displayName = atxpUser.name ?? null;

      await executeSql(
        'INSERT INTO users (email, atxp_account_id, display_name, role, grade_level) VALUES ($1, $2, $3, $4, $5)',
        [email, atxpAccountId, displayName, role, grade_level ?? null]
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
    return Response.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
