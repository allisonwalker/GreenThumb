import { requirePageUser } from "@/lib/auth/session";
import { listCropRecords } from "@/lib/crops/repository";

import { CatalogList } from "./catalog-list";

export default async function CatalogPage() {
  await requirePageUser();
  const crops = await listCropRecords();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-green-700">
          Crop catalog
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Shared care rows
        </h1>
        <p className="mt-3 max-w-2xl text-neutral-600">
          Every tomato planting of the same variety shares one watering cadence.
          Tomato and Tomato / Sungold are different rows. Search, open, and edit
          here — matching will skip a task if that field is still blank, rather
          than guessing.
        </p>
      </header>
      <CatalogList crops={crops} />
    </div>
  );
}
