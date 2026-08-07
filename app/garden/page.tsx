import { PlaceholderPage } from "@/components/placeholder-page";
import { requirePageUser } from "@/lib/auth/session";

export default async function GardenPage() {
  await requirePageUser();

  return (
    <PlaceholderPage
      title="Garden"
      description="Your raised bed, seasonal sections, pots, and plantings will live here."
    />
  );
}
