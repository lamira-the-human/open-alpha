import bcrypt from 'bcryptjs';
import { executeSql } from '../_lib/db.js';
import { signToken } from '../_lib/auth.js';

interface User {
  id: number;
  email: string;
  password_hash: string;
  display_name: string | null;
  role: 'student' | 'parent';
  grade_level: number | null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email: string; password: string };
    const { email, password } = body;

    if (!email || !password) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await executeSql<User>(
      'SELECT id, email, password_hash, display_name, role, grade_level FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return Response.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return Response.json({ error: 'Invalid email or password' }, { status: 401 });
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
    console.error('Login error:', error);
    return Response.json({ error: 'Failed to log in' }, { status: 500 });
  }
}
