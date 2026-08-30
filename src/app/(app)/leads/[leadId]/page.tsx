import { DecisionReceiptView } from "@/components/DecisionReceiptView";

export default async function LeadReceiptPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  return (
    <div className="mx-auto max-w-[1200px] px-5 py-10 sm:px-8 sm:py-12">
      <DecisionReceiptView leadId={leadId} />
    </div>
  );
}
