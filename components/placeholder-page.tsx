import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PlaceholderPageProps = {
  title: string;
  description: string;
};

export function PlaceholderPage({
  title,
  description,
}: PlaceholderPageProps) {
  return (
    <section className="mx-auto max-w-2xl">
      <p className="mb-2 text-sm font-medium text-green-700">GreenThumb</p>
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-neutral-600">{description}</p>
        </CardContent>
      </Card>
    </section>
  );
}
