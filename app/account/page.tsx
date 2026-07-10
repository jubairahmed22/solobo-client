import { redirect } from "next/navigation";

/**
 * /account is just an alias for the default landing tab - keep the URL clean
 * and bounce the user to the profile page.
 */
export default function AccountIndex() {
  redirect("/account/profile");
}
