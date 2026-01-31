import { executeSql } from '../_lib/db.js';
import { getAuthFromRequest, unauthorized } from '../_lib/auth.js';

interface User {
  id: number;
  email: string;
  display_name: string | null;
  role: 'student' | 'parent';
  grade_level: number | null;
}

export async function GET(request: Request) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth) return unauthorized();

    const result = await executeSql<User>(
      'SELECT id, email, display_name, role, grade_level FROM users WHERE id = $1',
      [auth.userId]
    );

    if (result.rows.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const user = result.rows[0];
    return Response.json({
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      gradeLevel: user.grade_level,
    });
  } catch (error) {
    console.error('Auth error:', error);
    return unauthorized();
  }
}
