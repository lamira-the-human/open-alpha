import { executeSql } from '../_lib/db.js';
import { getAuthFromRequest, unauthorized } from '../_lib/auth.js';

interface ParentLink {
  id: number;
  student_id: number;
}

interface User {
  id: number;
  display_name: string | null;
  grade_level: number | null;
}

export async function POST(request: Request) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth || auth.role !== 'parent') return unauthorized();

    const body = await request.json() as { inviteCode: string };
    const { inviteCode } = body;

    if (!inviteCode || inviteCode.length !== 8) {
      return Response.json({ error: 'Invalid invite code format' }, { status: 400 });
    }

    const linkResult = await executeSql<ParentLink>(
      'SELECT id, student_id FROM parent_links WHERE invite_code = $1 AND linked_at IS NULL',
      [inviteCode]
    );

    if (linkResult.rows.length === 0) {
      return Response.json({ error: 'Invalid or expired invite code' }, { status: 404 });
    }

    const link = linkResult.rows[0];

    const existingLink = await executeSql<{ id: number }>(
      'SELECT id FROM parent_links WHERE parent_id = $1 AND student_id = $2 AND linked_at IS NOT NULL',
      [auth.userId, link.student_id]
    );

    if (existingLink.rows.length > 0) {
      return Response.json({ error: 'Already linked to this student' }, { status: 400 });
    }

    await executeSql(
      "UPDATE parent_links SET parent_id = $1, linked_at = datetime('now'), invite_code = NULL WHERE id = $2",
      [auth.userId, link.id]
    );

    const studentResult = await executeSql<User>(
      'SELECT id, display_name, grade_level FROM users WHERE id = $1',
      [link.student_id]
    );

    return Response.json({ success: true, student: studentResult.rows[0] });
  } catch (error) {
    console.error('Link error:', error);
    return Response.json({ error: 'Failed to link accounts' }, { status: 500 });
  }
}
