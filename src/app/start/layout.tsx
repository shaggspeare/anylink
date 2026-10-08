import { redirect } from "next/navigation";
import { currentUser } from "@/lib/db/current-user";

/** Importing a bookmarks file is hundreds of saves at once — that needs an account. */
export default async function StartLayout({ children }: LayoutProps<"/start">) {
  if (!(await currentUser())) redirect("/login");
  return children;
}
