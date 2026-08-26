import { AppShell } from "@/components/app-shell";
import { getGardenName } from "@/lib/garden/profile-repository";
import { resolveGardenDisplayName } from "@/lib/shell/identity";

export async function AuthenticatedShell({
  children,
}: {
  children: React.ReactNode;
}) {
  let storedName: string | null = null;
  try {
    storedName = await getGardenName();
  } catch (error) {
    console.error("Could not load garden name for chrome", error);
  }

  return (
    <AppShell gardenName={resolveGardenDisplayName(storedName)}>
      {children}
    </AppShell>
  );
}
