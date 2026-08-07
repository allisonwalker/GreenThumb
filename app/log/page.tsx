import { PlaceholderPage } from "@/components/placeholder-page";
import { requirePageUser } from "@/lib/auth/session";

export default async function LogPage() {
  await requirePageUser();

  return (
    <PlaceholderPage
      title="Log"
      description="You will record watering, feeding, pruning, and observations here."
    />
  );
}
