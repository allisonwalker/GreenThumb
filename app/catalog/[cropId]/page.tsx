import { notFound } from "next/navigation";

import { requirePageUser } from "@/lib/auth/session";
import { getCropRecord } from "@/lib/crops/repository";

import { CropEditForm } from "./crop-edit-form";

type CropPageProps = {
  params: Promise<{ cropId: string }>;
};

export default async function CatalogCropPage({ params }: CropPageProps) {
  await requirePageUser();
  const { cropId } = await params;
  const crop = await getCropRecord(cropId);

  if (!crop) {
    notFound();
  }

  return (
    <CropEditForm
      key={`${crop.id}-${crop.source}-${crop.slug}-${crop.variety}-${crop.wateringIntervalDays}`}
      crop={crop}
    />
  );
}
