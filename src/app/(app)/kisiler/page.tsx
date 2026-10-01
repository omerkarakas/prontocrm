import { PeopleView } from "@/components/people/people-view";

export const metadata = { title: "Kişiler" };

export default async function KisilerPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string; new?: string }>;
}) {
  const params = await searchParams;
  return <PeopleView initialOpenId={params.open} initialNew={params.new === "1"} />;
}
