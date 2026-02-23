import Link from "next/link";

export default function Home() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start w-full max-w-4xl">
        <div className="flex flex-col gap-4 items-center sm:items-start w-full">
          <h1 className="text-6xl font-bold tracking-tight text-white mb-2">
            Structuro Studio
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl text-center sm:text-left">
            Advanced structural analysis interface for Frames, Beams, and RCC
            Design.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full mt-8">
          {/* Analysis Option Cards */}
          <Link
            href="/analysis?type=frames"
            className="group flex flex-col gap-4 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 transition-all hover:border-[var(--primary)] hover:shadow-lg hover:shadow-[var(--primary)]/20"
          >
            <div className="h-12 w-12 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center group-hover:bg-[var(--primary)]/20 transition-colors">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-[var(--primary)]"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M3 9h18" />
                <path d="M9 21V9" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold">Frames</h2>
            <p className="text-sm text-gray-400">
              Analyze 2D and 3D frames with customizable nodes and supports.
            </p>
          </Link>

          <Link
            href="/analysis?type=beams"
            className="group flex flex-col gap-4 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 transition-all hover:border-[var(--primary)] hover:shadow-lg hover:shadow-[var(--primary)]/20"
          >
            <div className="h-12 w-12 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center group-hover:bg-[var(--primary)]/20 transition-colors">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-[var(--primary)]"
              >
                <path d="M22 3H2v18h20v-9" />
                <path d="M2 12H22" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold">Beams</h2>
            <p className="text-sm text-gray-400">
              Design and analyze beams with various load configurations.
            </p>
          </Link>
        </div>
      </main>

      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center text-sm text-gray-500">
        <p>© 2026 Structuro. All rights reserved.</p>
      </footer>
    </div>
  );
}
