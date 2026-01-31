import { executeSql } from '../_lib/db.js';
import { getAuthFromRequest, unauthorized } from '../_lib/auth.js';

interface Child {
  id: number;
  email: string;
  display_name: string | null;
  grade_level: number | null;
  linked_at: string;
}

export async function GET(request: Request) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth || auth.role !== 'parent') return unauthorized();

    const result = await executeSql<Child>(
      `SELECT u.id, u.email, u.display_name, u.grade_level, pl.linked_at
       FROM parent_links pl
       JOIN users u ON pl.student_id = u.id
       WHERE pl.parent_id = $1 AND pl.linked_at IS NOT NULL`,
      [auth.userId]
    );

    return Response.json({ children: result.rows });
  } catch (error) {
    console.error('Get children error:', error);
    return Response.json({ error: 'Failed to get linked children' }, { status: 500 });
  }
}
