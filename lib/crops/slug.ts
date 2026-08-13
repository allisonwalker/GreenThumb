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

export function cropMatchesQuery(
  name: string,
  slug: string,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }

  return name.toLowerCase().includes(needle) || slug.includes(needle);
}
