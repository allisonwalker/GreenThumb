import { notFound } from "next/navigation";

import { requirePageUser } from "@/lib/auth/session";
import { getLocationPlantingsPage } from "@/lib/garden/planting-repository";

import { LocationPlantingsPanel } from "../location-plantings-panel";

type LocationPageProps = {
  params: Promise<{ locationId: string }>;
};

export default async function LocationPlantingsPage({
  params,
}: LocationPageProps) {
  await requirePageUser();
  const { locationId } = await params;
  const page = await getLocationPlantingsPage(locationId);

  if (!page) {
    notFound();
  }

  return (
    <LocationPlantingsPanel
      key={`${page.location.id}-${page.currentPlantings.length}-${page.pastPlantings.length}-${page.currentPlantings.map((p) => p.id).join(",")}`}
      page={page}
    />
  );
}
