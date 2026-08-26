import { requirePageUser } from "@/lib/auth/session";
import { listCropRecords } from "@/lib/crops/repository";

import { CatalogList } from "./catalog-list";

export default async function CatalogPage() {
  await requirePageUser();
  const crops = await listCropRecords();

  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <header>
        <h1 className="text-5xl font-bold leading-none tracking-display text-forest sm:text-6xl">
          Crop catalog
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-forest">
          Every tomato planting of the same variety shares one watering cadence.
          Tomato and Tomato / Sungold are different rows. Search, open, and edit
          here. If a cadence is still blank, that kind of task stays off
          Today&apos;s list until you fill it in.
        </p>
      </header>
      <CatalogList crops={crops} />
    </div>
  );
}
