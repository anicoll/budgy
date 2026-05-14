"use client";

import { LayoutGrid, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function AccountsEmpty({ onAdd }: { onAdd: () => void }) {
  return (
    <Card className="mx-auto max-w-md border-dashed border-border/70 bg-surface/40 backdrop-blur-md">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-accent text-primary-foreground shadow-md">
          <LayoutGrid className="h-6 w-6" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">No accounts yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your everyday account, savings, credit card, super — whatever you want to track.
          </p>
        </div>
        <Button
          onClick={onAdd}
          className="bg-gradient-accent text-primary-foreground hover:opacity-90"
        >
          <Plus className="mr-1 h-4 w-4" /> Add your first account
        </Button>
      </CardContent>
    </Card>
  );
}
