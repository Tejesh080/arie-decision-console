import { Suspense } from "react";
import { NewLeadForm } from "@/components/NewLeadForm";

export default function NewLeadPage() {
  return (
    <div className="mx-auto max-w-[1200px] px-5 py-10 sm:px-8 sm:py-14">
      {/* NewLeadForm reads `?run=` to fire a prepared example, and
          useSearchParams opts a route into client rendering unless it sits
          behind a Suspense boundary. */}
      <Suspense fallback={<div className="skeleton h-[28rem] w-full rounded-xl" />}>
        <NewLeadForm />
      </Suspense>
    </div>
  );
}
