import { CheckoutReturnView } from "@/components/billing/CheckoutReturnView";

export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const normalized = status === "success" || status === "canceled" ? status : null;
  return <CheckoutReturnView status={normalized} />;
}
