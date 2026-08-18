import { DecisionReceiptView } from "@/components/DecisionReceiptView";

export default async function LeadReceiptPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <DecisionReceiptView leadId={leadId} />
    </div>
  );
}
