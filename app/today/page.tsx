import { PlaceholderPage } from "@/components/placeholder-page";
import { requirePageUser } from "@/lib/auth/session";

export default async function TodayPage() {
  await requirePageUser();

  return (
    <PlaceholderPage
      title="Today"
      description="Your open garden-care recommendations will appear here."
    />
  );
}
