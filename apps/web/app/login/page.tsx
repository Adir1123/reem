import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ next?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const { next, error } = await searchParams;

  return (
    <main className="bg-bg flex min-h-screen flex-1 items-center justify-center px-6 py-16">
      <div className="border-rule bg-bg-card w-full max-w-md rounded-md border p-10">
        <p className="font-display text-gold-warm text-xs tracking-[0.32em] uppercase">
          PFT · לוח בקרה
        </p>
        <h1 className="text-cream font-display mt-3 text-3xl italic">
          התחברות
        </h1>
        <p className="text-cream/55 mt-2 text-sm">
          הזן את כתובת המייל שלך ונשלח לך קישור התחברות.
        </p>

        <LoginForm next={next} initialError={error} />
      </div>
    </main>
  );
}
