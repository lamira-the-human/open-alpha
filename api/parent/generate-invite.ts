import crypto from 'crypto';
import { executeSql } from '../_lib/db.js';
import { getAuthFromRequest, unauthorized } from '../_lib/auth.js';

interface ParentLink {
  id: number;
}

export async function POST(request: Request) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth || auth.role !== 'student') return unauthorized();

    const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();

    const existing = await executeSql<ParentLink>(
      'SELECT id FROM parent_links WHERE student_id = $1 AND linked_at IS NULL',
      [auth.userId]
    );

    if (existing.rows.length > 0) {
      await executeSql(
        'UPDATE parent_links SET invite_code = $1 WHERE student_id = $2 AND linked_at IS NULL',
        [inviteCode, auth.userId]
      );
    } else {
      await executeSql(
        'INSERT INTO parent_links (student_id, invite_code) VALUES ($1, $2)',
        [auth.userId, inviteCode]
      );
    }

    return Response.json({ inviteCode });
  } catch (error) {
    console.error('Generate invite error:', error);
    return Response.json({ error: 'Failed to generate invite code' }, { status: 500 });
  }
}
