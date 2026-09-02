import { Card } from "@/components/ui/Card";

export function ComingSoon({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-ink-950">{title}</h1>
      <Card className="border-dashed py-16 text-center">
        <p className="text-sm text-ink-500">
          Esta sección se implementa en la <span className="font-medium text-ink-700">{phase}</span>.
        </p>
      </Card>
    </div>
  );
}
