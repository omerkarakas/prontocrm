import { EventDetailView } from "@/components/events/event-detail-view";

export const metadata = { title: "Etkinlik detayı" };

export default async function EtkinlikDetayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EventDetailView eventId={id} />;
}
