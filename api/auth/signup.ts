import bcrypt from 'bcryptjs';
import { executeSql } from '../_lib/db.js';
import { signToken } from '../_lib/auth.js';

interface User {
  id: number;
  email: string;
  display_name: string | null;
  role: 'student' | 'parent';
  grade_level: number | null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      email: string;
      password: string;
      displayName?: string;
      role: 'student' | 'parent';
      gradeLevel?: number;
    };
    const { email, password, displayName, role, gradeLevel } = body;

    if (!email || !password || !role) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (role === 'student' && gradeLevel === undefined) {
      return Response.json({ error: 'Grade level is required for students' }, { status: 400 });
    }

    // Check if email exists
    const existing = await executeSql<{ id: number }>(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      return Response.json({ error: 'Email already registered' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await executeSql<User>(
      `INSERT INTO users (email, password_hash, display_name, role, grade_level)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, display_name, role, grade_level`,
      [email, passwordHash, displayName || null, role, gradeLevel ?? null]
    );

    const user = result.rows[0];
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
    }, { status: 201 });
  } catch (error) {
    console.error('Signup error:', error);
    return Response.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
