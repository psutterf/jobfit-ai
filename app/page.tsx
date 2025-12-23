import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border p-6 space-y-4">
        <h1 className="text-2xl font-semibold">JobFit AI</h1>
        <p className="text-sm text-gray-600">
          Build tailored resumes and cover letters in minutes.
        </p>

        <Link
          className="inline-block rounded-md border px-4 py-2"
          href="/login"
        >
          Go to Login
        </Link>
      </div>
    </main>
  );
}
