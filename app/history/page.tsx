import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import HistoryList from '../components/HistoryList';
import Link from 'next/link';

export default async function HistoryPage() {
  const session = await getSession();

  if (!session.isLoggedIn) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <nav className="border-b border-gray-800 bg-[#242424]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-[#ff8c00] hover:text-[#ff9d1f] transition-colors">
            Video Creator
          </Link>
          <Link
            href="/"
            className="text-gray-300 hover:text-white transition-colors"
          >
            New Video
          </Link>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="mb-12">
          <h2 className="text-4xl font-bold mb-4">Video History</h2>
          <p className="text-gray-400 text-lg">
            View and manage your previously generated videos
          </p>
        </div>

        <HistoryList />
      </main>
    </div>
  );
}
