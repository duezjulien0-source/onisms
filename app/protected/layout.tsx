import { Sidebar } from "@/components/sidebar";
import { getAgencyWallet, getCurrentProfile } from "@/lib/profile";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  const wallet = await getAgencyWallet();

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar profile={profile} wallet={wallet} />
      <main className="flex-1 overflow-x-auto">{children}</main>
    </div>
  );
}
