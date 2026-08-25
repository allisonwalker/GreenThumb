export function cropSlug(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) {
    throw new Error("Crop name must include letters or numbers.");
  }

  return slug;
}

export function normalizeVariety(variety: string | null | undefined): string | null {
  if (variety == null) {
    return null;
  }
  const trimmed = variety.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function catalogSlug(name: string, variety: string | null): string {
  const nameSlug = cropSlug(name);
  const normalized = normalizeVariety(variety);
  if (!normalized) {
    return nameSlug;
  }

  try {
    return `${nameSlug}--${cropSlug(normalized)}`;
  } catch {
    throw new Error("Variety must include letters or numbers.");
  }
}

export function cropIdentityLabel(name: string, variety: string | null): string {
  const normalized = normalizeVariety(variety);
  return normalized ? `${name} / ${normalized}` : name;
}

export function cropCareCopyLabel(cropName: string, variety: string | null): string {
  const normalized = normalizeVariety(variety);
  return normalized ? `${normalized} ${cropName}` : cropName;
}

export function cropMatchesQuery(
  name: string,
  slug: string,
  query: string,
  variety?: string | null,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }

  return (
    name.toLowerCase().includes(needle) ||
    slug.includes(needle) ||
    (variety != null && variety.toLowerCase().includes(needle))
  );
}
