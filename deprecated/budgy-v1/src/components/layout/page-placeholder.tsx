import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PagePlaceholder({
  icon: Icon,
  title,
  description,
  milestone,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  milestone: string;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <Card className="border-border/60 bg-surface/60 backdrop-blur-xl">
        <CardHeader className="flex flex-row items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-accent text-primary-foreground">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <p className="text-xs text-muted-foreground">Coming in {milestone}</p>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </div>
  );
}
