import { executeSql } from '../_lib/db.js';
import { getAuthFromRequest, unauthorized } from '../_lib/auth.js';

interface Interest {
  id: number;
  user_id: number;
  category: string;
  value: string;
  weight: number;
  created_at: string;
}

// GET — fetch all interests for the authenticated student
export async function GET(request: Request) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth || auth.role !== 'student') return unauthorized();

    const result = await executeSql<Interest>(
      'SELECT id, category, value, weight FROM user_interests WHERE user_id = $1 ORDER BY weight DESC, created_at ASC',
      [auth.userId]
    );

    return Response.json({ interests: result.rows });
  } catch (error) {
    console.error('Get interests error:', error);
    return Response.json({ error: 'Failed to load interests' }, { status: 500 });
  }
}

// POST — add or replace a student's full interest profile
// Body: { interests: Array<{ category, value, weight? }> }
export async function POST(request: Request) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth || auth.role !== 'student') return unauthorized();

    const body = await request.json() as {
      interests: Array<{ category: string; value: string; weight?: number }>;
    };

    if (!body.interests || !Array.isArray(body.interests)) {
      return Response.json({ error: 'interests array is required' }, { status: 400 });
    }

    const validCategories = ['hobby', 'sport', 'media', 'hero', 'career', 'other'];
    for (const interest of body.interests) {
      if (!validCategories.includes(interest.category)) {
        return Response.json({ error: `Invalid category: ${interest.category}` }, { status: 400 });
      }
      if (!interest.value || interest.value.trim().length === 0) {
        return Response.json({ error: 'Interest value cannot be empty' }, { status: 400 });
      }
      if (interest.value.length > 100) {
        return Response.json({ error: 'Interest value must be 100 characters or fewer' }, { status: 400 });
      }
    }

    // Replace all interests for this user (simple overwrite strategy)
    await executeSql('DELETE FROM user_interests WHERE user_id = $1', [auth.userId]);

    for (const interest of body.interests) {
      await executeSql(
        'INSERT INTO user_interests (user_id, category, value, weight) VALUES ($1, $2, $3, $4)',
        [auth.userId, interest.category, interest.value.trim(), interest.weight ?? 1.0]
      );
    }

    // Return the saved interests
    const result = await executeSql<Interest>(
      'SELECT id, category, value, weight FROM user_interests WHERE user_id = $1 ORDER BY weight DESC, created_at ASC',
      [auth.userId]
    );

    return Response.json({ interests: result.rows });
  } catch (error) {
    console.error('Save interests error:', error);
    return Response.json({ error: 'Failed to save interests' }, { status: 500 });
  }
}

// DELETE — remove a single interest by id
export async function DELETE(request: Request) {
  try {
    const auth = getAuthFromRequest(request);
    if (!auth || auth.role !== 'student') return unauthorized();

    const url = new URL(request.url);
    const interestId = url.searchParams.get('id');

    if (!interestId) {
      return Response.json({ error: 'id query parameter is required' }, { status: 400 });
    }

    await executeSql(
      'DELETE FROM user_interests WHERE id = $1 AND user_id = $2',
      [parseInt(interestId), auth.userId]
    );

    return Response.json({ success: true });
  } catch (error) {
    console.error('Delete interest error:', error);
    return Response.json({ error: 'Failed to delete interest' }, { status: 500 });
  }
}
