import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import GenerateForm from './components/GenerateForm';
import Link from 'next/link';

export default async function HomePage() {
  const session = await getSession();

  if (!session.isLoggedIn) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <nav className="border-b border-gray-800 bg-[#242424]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-[#ff8c00]">Video Creator</h1>
          <div className="flex gap-4 items-center">
            <Link
              href="/history"
              className="text-gray-300 hover:text-white transition-colors"
            >
              History
            </Link>
            <span className="text-gray-500">|</span>
            <span className="text-gray-400">{session.email}</span>
            <form action="/api/auth" method="DELETE">
              <button
                type="submit"
                className="text-gray-300 hover:text-white transition-colors"
              >
                Logout
              </button>
            </form>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Create AI Video</h2>
          <p className="text-gray-400 text-lg">
            Generate animated videos with AI-powered images, narration, and motion
          </p>
        </div>

        <GenerateForm />
      </main>
    </div>
  );
}
