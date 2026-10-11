import { redirect } from "next/navigation";
import { AmbientOrbs } from "@/components/ambient-orbs";
import { NewPasswordForm } from "@/components/auth-panel";
import { currentUser } from "@/lib/db/current-user";

export const metadata = { title: "New password — AnyLink" };

/** The reset link signs them in on its way here (via /auth/callback); without that session the link failed. */
export default async function ResetPasswordPage() {
  if (!(await currentUser())) redirect("/login?error=1");
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-canvas p-6">
      <AmbientOrbs variant="library" />
      <div className="glass-55 relative flex w-full max-w-md justify-center rounded-[28px] p-8">
        <NewPasswordForm />
      </div>
    </div>
  );
}
