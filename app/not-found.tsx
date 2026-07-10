import Link from "next/link";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="container-screen flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <p className="font-mono text-sm text-neutral-500">404</p>
      <h1>Page not found</h1>
      <p className="max-w-prose text-neutral-600">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link href="/">
        <Button>Back to home</Button>
      </Link>
    </main>
  );
}
