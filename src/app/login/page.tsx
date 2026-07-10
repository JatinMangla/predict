import { signIn, auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="card w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[--color-gold] text-3xl">
          ॐ
        </div>
        <h1 className="text-2xl font-semibold tracking-wide text-[--color-gold-soft]">
          Kundli Predict
        </h1>
        <p className="mt-2 text-sm text-[--color-ink-soft]">
          Vedic astrology · Kundli · Dashas · Predictions · Numerology
          <br />
          <span className="text-xs">कुंडली · दशा · भविष्यफल · अंक ज्योतिष</span>
        </p>

        {error === "AccessDenied" && (
          <p className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            This account is not authorized to use this application.
            <br />
            यह खाता अधिकृत नहीं है।
          </p>
        )}

        <form
          className="mt-8"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-lg bg-[--color-gold] px-4 py-3 font-medium text-[#1a1405] transition hover:brightness-110"
          >
            Sign in with Google
          </button>
        </form>

        <p className="mt-4 text-xs text-[--color-ink-soft]">
          Only the owner&apos;s Google account can sign in. All kundli data
          stays on your device.
        </p>
      </div>
    </main>
  );
}
