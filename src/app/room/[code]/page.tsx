import { notFound } from "next/navigation";
import RoomClient from "@/components/RoomClient";

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^\d{6}$/.test(code)) notFound();
  return <RoomClient code={code} />;
}
