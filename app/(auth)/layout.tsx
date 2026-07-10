import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AuthGroupLayout({ children }: { children: React.ReactNode }) {
  // If already signed in, send them onward - auth pages are for anonymous users.
  const session = await auth();
  if (session?.user?.id) {
    const dest =
      session.user.role === "superadmin" || session.user.role === "admin"
        ? "/admin"
        : "/account";
    redirect(dest);
  }
  return <>{children}</>;
}
