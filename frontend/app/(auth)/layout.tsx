/**
 * Minimal centered layout for unauthenticated pages (/login, etc.).
 * No sidebar, no header — just a centered card on a neutral background.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      {children}
    </div>
  );
}
