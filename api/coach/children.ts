import { executeSql } from '../_lib/db.js';
import { getAuthFromRequest, unauthorized } from '../_lib/auth.js';

interface Child {
  student_id: number;
  grade_level: number;
  display_name: string | null;
}

export async function GET(request: Request) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth || auth.role !== 'parent') return unauthorized();

    const result = await executeSql<Child>(
      `SELECT pl.student_id, u.grade_level, u.display_name
       FROM parent_links pl
       JOIN users u ON pl.student_id = u.id
       WHERE pl.parent_id = $1 AND pl.linked_at IS NOT NULL`,
      [auth.userId]
    );

    return Response.json({ children: result.rows });
  } catch (error) {
    console.error('Get children error:', error);
    return Response.json({ error: 'Failed to get children' }, { status: 500 });
  }
}
