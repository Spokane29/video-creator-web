import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getHistory } from '@/lib/jobs';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const history = await getHistory();
    return NextResponse.json({ jobs: history });
  } catch (error: any) {
    console.error('History error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get history' },
      { status: 500 }
    );
  }
}
