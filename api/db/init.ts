import { initializeSchema } from '../_lib/db.js';

export async function POST(request: Request) {
  // Simple auth check - in production use a proper admin key
  const authHeader = request.headers.get('authorization');
  const adminKey = process.env.ADMIN_INIT_KEY;

  if (!adminKey || authHeader !== `Bearer ${adminKey}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await initializeSchema();
    return Response.json({ success: true, message: 'Database initialized' });
  } catch (error) {
    console.error('DB init error:', error);
    return Response.json({ error: 'Failed to initialize database' }, { status: 500 });
  }
}
