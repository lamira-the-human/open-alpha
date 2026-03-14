/**
 * POST /api/parent/create-child
 *
 * COPPA age-gate solution: parents create accounts FOR their children.
 * Children under 13 cannot create their own accounts — this is the
 * COPPA-compliant flow where the parent maintains control.
 *
 * The child account is created with:
 *   - A system-generated email (not real, just a unique internal ID)
 *   - No password (child accesses via parent dashboard or a PIN set by parent)
 *   - Parent automatically linked as guardian
 *   - Parent maintains full access to the child's progress and sessions
 *
 * This also solves friction for parents who want to set up accounts for
 * their kids without needing the kid present with an email address.
 *
 * Request body:
 * {
 *   childName: string,       // display name for the child
 *   gradeLevel: number,      // 0-12
 *   accessPin?: string       // optional 4-6 digit PIN for child to self-login on shared device
 * }
 *
 * Returns: { childId, childEmail, accessPin, linkId }
 */

import bcrypt from 'bcryptjs';
import { executeSql } from '../_lib/db.js';
import { getAuthFromRequest, unauthorized } from '../_lib/auth.js';

interface ParentUser {
  id: number;
  email: string;
}

export async function POST(request: Request) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth || auth.role !== 'parent') return unauthorized();

    const body = await request.json() as {
      childName: string;
      gradeLevel: number;
      accessPin?: string;
    };

    const { childName, gradeLevel, accessPin } = body;

    if (!childName || childName.trim().length < 1) {
      return Response.json({ error: 'childName is required' }, { status: 400 });
    }

    if (typeof gradeLevel !== 'number' || gradeLevel < 0 || gradeLevel > 12) {
      return Response.json({ error: 'gradeLevel must be a number between 0 and 12' }, { status: 400 });
    }

    if (accessPin && (!/^\d{4,6}$/.test(accessPin))) {
      return Response.json({ error: 'accessPin must be 4-6 digits' }, { status: 400 });
    }

    // Get parent's email to construct a system email for the child
    const parentResult = await executeSql<ParentUser>(
      'SELECT id, email FROM users WHERE id = $1',
      [auth.userId]
    );

    if (parentResult.rows.length === 0) {
      return Response.json({ error: 'Parent account not found' }, { status: 404 });
    }

    const parentEmail = parentResult.rows[0].email;
    const parentDomain = parentEmail.split('@')[1] || 'family';
    const childSlug = childName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 12);
    const uniqueSuffix = Math.random().toString(36).substring(2, 8);

    // System email — not a real address, used only as a unique key
    const childSystemEmail = `child.${childSlug}.${uniqueSuffix}@managed.${parentDomain}`;

    // Hash PIN if provided (store as password_hash so child can log in with it)
    let passwordHash: string | null = null;
    if (accessPin) {
      passwordHash = await bcrypt.hash(accessPin, 10);
    }

    // Check child limit per parent (max 10 children per parent account)
    const childCountResult = await executeSql<{ count: number }>(
      `SELECT COUNT(*) as count FROM parent_links
       WHERE parent_id = $1 AND linked_at IS NOT NULL`,
      [auth.userId]
    );

    if (Number(childCountResult.rows[0]?.count) >= 10) {
      return Response.json({ error: 'Maximum of 10 children per parent account' }, { status: 400 });
    }

    // Create the child student account
    const childResult = await executeSql<{ id: number }>(
      `INSERT INTO users (email, password_hash, display_name, role, grade_level)
       VALUES ($1, $2, $3, 'student', $4)
       RETURNING id`,
      [childSystemEmail, passwordHash, childName.trim(), gradeLevel]
    );

    const childId = childResult.rows[0].id;

    // Auto-link parent to child (no invite code needed — parent created the account)
    await executeSql(
      `INSERT INTO parent_links (parent_id, student_id, invite_code, linked_at)
       VALUES ($1, $2, NULL, datetime('now'))`,
      [auth.userId, childId]
    );

    return Response.json({
      success: true,
      child: {
        id: childId,
        displayName: childName.trim(),
        gradeLevel,
        systemEmail: childSystemEmail,
        hasAccessPin: !!accessPin,
      },
      message: `Child account for ${childName.trim()} created and linked to your parent account.`,
      nextSteps: {
        viewProgress: `/api/parent/children/${childId}/progress`,
        setUpLearning: 'Your child can now be selected from your parent dashboard to start learning.',
        sharedDevice: accessPin
          ? `On a shared device, your child can log in with email: ${childSystemEmail} and the PIN you set.`
          : 'You can add an access PIN later so your child can log in independently.',
      },
    });
  } catch (error) {
    console.error('Create child error:', error);
    return Response.json({ error: 'Failed to create child account' }, { status: 500 });
  }
}
