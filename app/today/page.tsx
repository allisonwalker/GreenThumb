import Link from "next/link";

import { PlaceholderPage } from "@/components/placeholder-page";
import { requirePageUser } from "@/lib/auth/session";

export default async function TodayPage() {
  await requirePageUser();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PlaceholderPage
        title="Today"
        description="Your open garden-care recommendations will appear here."
      />
      <p className="text-neutral-600">
        Short on time?{" "}
        <Link
          href="/ask?mode=hours"
          className="font-semibold text-green-800 underline"
        >
          Say how many hours you have
        </Link>{" "}
        and we will cut the open list into must-do vs if-you-have-time. That
        screen does not change Today — mark work done here when the list
        exists.
      </p>
    </div>
  );
}
