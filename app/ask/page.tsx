import { PlaceholderPage } from "@/components/placeholder-page";
import { requirePageUser } from "@/lib/auth/session";

export default async function AskPage() {
  await requirePageUser();

  return (
    <PlaceholderPage
      title="Ask"
      description="Garden questions grounded in your weather and care history will go here."
    />
  );
}
