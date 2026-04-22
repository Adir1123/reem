import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ next?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const { next, error } = await searchParams;

  return (
    <main className="bg-cream-soft flex min-h-screen flex-1 items-center justify-center px-6 py-16">
      <div className="border-navy/10 w-full max-w-md rounded-3xl border bg-white p-10 shadow-sm">
        <p className="font-display text-gold text-xs tracking-[0.25em] uppercase">
          PFT · לוח בקרה
        </p>
        <h1 className="font-display text-navy mt-3 text-3xl font-black">
          התחברות
        </h1>
        <p className="text-muted mt-2 text-sm">
          הזן את כתובת המייל שלך ונשלח לך קישור התחברות.
        </p>

        <LoginForm next={next} initialError={error} />
      </div>
    </main>
  );
}
