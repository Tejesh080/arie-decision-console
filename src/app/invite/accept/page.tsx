import { InviteAcceptView } from "@/components/invite/InviteAcceptView";

export default async function InviteAcceptPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <InviteAcceptView token={token ?? null} />;
}
