import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent?: "default" | "warning" | "destructive" | "muted";
}

export function KpiCard({ icon, label, value, sub, accent = "default" }: KpiCardProps) {
  const valueColor =
    accent === "destructive"
      ? "text-destructive"
      : accent === "warning"
      ? "text-warning"
      : accent === "muted"
      ? "text-muted-foreground"
      : "text-foreground";

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          {icon} {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
