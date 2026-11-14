import Link from "next/link";
import { redirect } from "next/navigation";

// Supabase-style email links (older signup confirmations) land on the site root
// with ?code=... — hand those to the confirm route instead of showing the homepage.
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error_description?: string }>
}) {
  const { code, error_description } = await searchParams
  if (code) redirect(`/auth/confirm?code=${encodeURIComponent(code)}`)
  if (error_description) redirect('/login?notice=link-expired')

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-fuchsia-700 via-fuchsia-600 to-purple-700 px-6 py-24 text-center text-white">
      <h1 className="text-5xl font-black tracking-tight sm:text-6xl">
        Fantasy TV
      </h1>
      <p className="mt-4 max-w-md text-lg text-fuchsia-100">
        Draft brackets, lock in weekly picks, and battle your friends over
        who gets eliminated next — for any reality TV show.
      </p>
      <div className="mt-10 flex flex-col gap-4 sm:flex-row">
        <Link
          href="/signup"
          className="rounded-full bg-white px-8 py-3 font-semibold text-fuchsia-700 shadow-lg transition-colors hover:bg-fuchsia-50"
        >
          Sign up
        </Link>
        <Link
          href="/login"
          className="rounded-full border-2 border-white px-8 py-3 font-semibold text-white transition-colors hover:bg-white/10"
        >
          Log in
        </Link>
      </div>
    </div>
  );
}
