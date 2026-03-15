import LoginForm from "./login-form";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const hasError = resolvedSearchParams?.error === "invalid_credentials";
  const showDevAutofill =
    process.env.NODE_ENV === "development"
    && Boolean(process.env.ADMIN_EMAIL)
    && Boolean(process.env.ADMIN_PASSWORD);
  const devDefaults = showDevAutofill
    ? {
      email: process.env.ADMIN_EMAIL ?? "",
      password: process.env.ADMIN_PASSWORD ?? "",
    }
    : undefined;

  return (
    <main className="mx-auto flex min-h-screen w-[min(560px,92vw)] items-center">
      <section className="w-full rounded-3xl border border-white/70 bg-white/85 p-8 shadow-glass backdrop-blur">
        <LoginForm hasError={hasError} devDefaults={devDefaults} />
      </section>
    </main>
  );
}
