import { redirect } from "next/navigation";
import { AmbientOrbs } from "@/components/ambient-orbs";
import { AuthPanel } from "@/components/auth-panel";
import { currentUser } from "@/lib/db/current-user";

export const metadata = { title: "Sign in — AnyLink" };

export default async function LoginPage(props: PageProps<"/login">) {
  if (await currentUser()) redirect("/app");
  const { error } = await props.searchParams;
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-canvas p-6">
      <AmbientOrbs variant="library" />
      <div className="glass-55 relative flex w-full max-w-md justify-center rounded-[28px] p-8">
        <AuthPanel subtitle={error ? "That sign-in link didn't work. Try again." : undefined} />
      </div>
    </div>
  );
}
