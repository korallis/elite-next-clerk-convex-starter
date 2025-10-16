import { StakeholderMetricsClient } from "./stakeholder-metrics-client";

export default function StakeholderMetricsPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Stakeholder Metrics</h1>
        <p className="text-muted-foreground text-sm">
          Executive KPIs for Leo AI Analytics across adoption, accuracy, performance, and trust.
        </p>
      </div>
      <StakeholderMetricsClient />
    </div>
  );
}
