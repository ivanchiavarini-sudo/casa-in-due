import { requireWorkspace } from "@/lib/workspace";
import { LogoutButton } from "@/components/logout-button";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const workspace = await requireWorkspace();

  return (
    <div className="standalone-shell">
      <header className="standalone-topbar">
        <div>
          <p className="eyebrow">Organizzazione familiare</p>
          <strong>Casa in due</strong>
        </div>
        <div className="standalone-user">
          <span>{workspace.user.displayName}</span>
          <LogoutButton />
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
