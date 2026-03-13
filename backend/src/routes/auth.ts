import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { executeSql } from '../services/atxp-db.js';

const router = Router();

// Read env vars lazily (ES module imports are hoisted before dotenv.config runs)
const getJwtSecret = () => process.env.JWT_SECRET || 'development-secret-change-in-production';
const getAtxpIssuer = () => process.env.ATXP_ISSUER ?? 'https://auth.atxp.ai';
const getAtxpClientId = () => process.env.ATXP_CLIENT_ID;
const getAtxpClientSecret = () => process.env.ATXP_CLIENT_SECRET;

// Validation schemas
const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(1).optional(),
  role: z.enum(['student', 'parent']),
  gradeLevel: z.number().min(0).max(12).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

interface User {
  id: number;
  email: string;
  password_hash: string;
  display_name: string | null;
  role: 'student' | 'parent';
  grade_level: number | null;
  created_at: string;
}

// Signup
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const data = signupSchema.parse(req.body);

    // Validate grade level for students
    if (data.role === 'student' && data.gradeLevel === undefined) {
      res.status(400).json({ error: 'Grade level is required for students' });
      return;
    }

    // Check if email already exists
    const existing = await executeSql<User>(
      'SELECT id FROM users WHERE email = $1',
      [data.email]
    );

    if (existing.rows.length > 0) {
      res.status(400).json({ error: 'Email already registered' });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // Insert user
    const result = await executeSql<User>(
      `INSERT INTO users (email, password_hash, display_name, role, grade_level)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, display_name, role, grade_level, created_at`,
      [data.email, passwordHash, data.displayName || null, data.role, data.gradeLevel || null]
    );

    const user = result.rows[0];

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    res.status(201).json({
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
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const data = loginSchema.parse(req.body);

    // Find user
    const result = await executeSql<User>(
      'SELECT id, email, password_hash, display_name, role, grade_level FROM users WHERE email = $1',
      [data.email]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const user = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(data.password, user.password_hash);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    res.json({
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
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

// Get current user
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, getJwtSecret()) as { userId: number; role: string };

    const result = await executeSql<User>(
      'SELECT id, email, display_name, role, grade_level FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      gradeLevel: user.grade_level,
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// --- ATXP OIDC helpers ---

interface OIDCConfig {
  authorization_endpoint: string;
  token_endpoint: string;
}
let cachedOIDCConfig: OIDCConfig | null = null;

async function getOIDCConfig(): Promise<OIDCConfig> {
  if (cachedOIDCConfig) return cachedOIDCConfig;
  const res = await fetch(`${getAtxpIssuer()}/.well-known/openid-configuration`);
  if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`);
  cachedOIDCConfig = await res.json() as OIDCConfig;
  return cachedOIDCConfig;
}

function base64url(buffer: Buffer): string {
  return buffer.toString('base64url');
}

function generatePKCE() {
  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(
    crypto.createHash('sha256').update(codeVerifier).digest()
  );
  return { codeVerifier, codeChallenge };
}

function generateState(): string {
  return base64url(crypto.randomBytes(16));
}

function parseIdTokenClaims(idToken: string): Record<string, unknown> {
  const parts = idToken.split('.');
  if (parts.length < 2) return {};
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));
  } catch {
    return {};
  }
}

// --- ATXP OIDC routes ---

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

// Initiate ATXP OIDC flow
router.post('/atxp-initiate', async (req: Request, res: Response) => {
  try {
    const clientId = getAtxpClientId();
    if (!clientId) {
      res.status(503).json({ error: 'ATXP OAuth not configured. Set ATXP_CLIENT_ID env var.' });
      return;
    }

    const { role, gradeLevel } = req.body as { role?: string; gradeLevel?: number };

    const { codeVerifier, codeChallenge } = generatePKCE();
    const state = generateState();

    await executeSql(
      'INSERT INTO oauth_pkce (state, code_verifier, role, grade_level) VALUES ($1, $2, $3, $4)',
      [state, codeVerifier, role ?? null, gradeLevel ?? null]
    );

    // Build callback URL relative to the frontend (which proxies /api to us)
    const protocol = req.protocol;
    const host = req.get('host') || 'localhost:3001';
    // The callback goes to the frontend route, not the API
    const callbackUrl = `${protocol}://${host.replace(':3001', ':3000')}/auth/callback`;

    const { authorization_endpoint } = await getOIDCConfig();
    const authUrl = new URL(authorization_endpoint);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', callbackUrl);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('scope', 'openid profile email atxp.connection_token');
    authUrl.searchParams.set('tpl', 'edu');

    res.json({ authorizationUrl: authUrl.toString() });
  } catch (error) {
    console.error('ATXP initiate error:', error);
    res.status(500).json({ error: 'Failed to initiate authentication' });
  }
});

// Handle ATXP OIDC callback
router.get('/atxp-callback', async (req: Request, res: Response) => {
  try {
    const clientId = getAtxpClientId();
    const clientSecret = getAtxpClientSecret();
    if (!clientId || !clientSecret) {
      res.status(503).json({ error: 'ATXP OAuth not configured. Set ATXP_CLIENT_ID and ATXP_CLIENT_SECRET env vars.' });
      return;
    }

    const { code, state, error: errorParam } = req.query as Record<string, string>;

    if (errorParam) {
      res.status(400).json({ error: `ATXP auth error: ${errorParam}` });
      return;
    }

    if (!code || !state) {
      res.status(400).json({ error: 'Missing code or state' });
      return;
    }

    const pkceResult = await executeSql<PKCERow>(
      'SELECT code_verifier, role, grade_level FROM oauth_pkce WHERE state = $1',
      [state]
    );

    if (pkceResult.rows.length === 0) {
      res.status(400).json({ error: 'Invalid or expired state' });
      return;
    }

    const { code_verifier, role, grade_level } = pkceResult.rows[0];
    await executeSql('DELETE FROM oauth_pkce WHERE state = $1', [state]);

    const protocol = req.protocol;
    const host = req.get('host') || 'localhost:3001';
    const callbackUrl = `${protocol}://${host.replace(':3001', ':3000')}/auth/callback`;

    const { token_endpoint } = await getOIDCConfig();

    const tokenRes = await fetch(token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUrl,
        client_id: clientId,
        client_secret: clientSecret,
        code_verifier,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('Token exchange failed:', err);
      res.status(401).json({ error: 'Token exchange failed' });
      return;
    }

    const tokenData = await tokenRes.json() as { access_token: string; id_token?: string };

    const claims = tokenData.id_token ? parseIdTokenClaims(tokenData.id_token) : {};
    const atxpAccountId = claims.sub as string | undefined;
    const connectionToken = claims.atxp_connection_token as string | undefined;
    const displayName = (claims.name ?? null) as string | null;
    const email = (claims.email as string | undefined) ?? (atxpAccountId ? `atxp:${atxpAccountId}` : null);

    if (!atxpAccountId) {
      res.status(401).json({ error: 'No account identifier in token response' });
      return;
    }

    // Look up by atxp_account_id first, then fall back to email (for legacy accounts)
    let existingUser = await executeSql<UserRow>(
      'SELECT id, email, display_name, role, grade_level, atxp_account_id FROM users WHERE atxp_account_id = $1',
      [atxpAccountId]
    );

    if (existingUser.rows.length === 0 && email) {
      existingUser = await executeSql<UserRow>(
        'SELECT id, email, display_name, role, grade_level, atxp_account_id FROM users WHERE email = $1',
        [email]
      );
    }

    let user: UserRow;

    if (existingUser.rows.length > 0) {
      user = existingUser.rows[0];
      // Link ATXP account to existing user and update connection token
      await executeSql(
        'UPDATE users SET atxp_account_id = $1, atxp_connection_token = $2 WHERE id = $3',
        [atxpAccountId, connectionToken ?? null, user.id]
      );
    } else {
      if (!role) {
        res.status(404).json({
          error: 'no_account',
          message: 'No Open Alpha account found. Please sign up first.',
        });
        return;
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

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    res.json({
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
    res.status(500).json({ error: 'Authentication failed' });
  }
});

export default router;
