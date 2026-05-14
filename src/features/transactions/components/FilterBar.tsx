"use client";

import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Account } from "@/features/accounts/types";
import type { Category } from "@/features/categories/types";

export interface TxnFilters {
  search: string;
  accountId: string;
  categoryId: string;
  type: string;
}

const INITIAL_FILTERS: TxnFilters = {
  search: "",
  accountId: "all",
  categoryId: "all",
  type: "all",
};

interface Props {
  filters: TxnFilters;
  onChange: (f: TxnFilters) => void;
  accounts: Account[];
  categories: Category[];
}

export function FilterBar({ filters, onChange, accounts, categories }: Props) {
  const hasActive =
    filters.search ||
    filters.accountId !== "all" ||
    filters.categoryId !== "all" ||
    filters.type !== "all";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search payee or notes…"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="pl-8 text-sm"
          />
        </div>

        <Select
          value={filters.accountId}
          onValueChange={(v) => onChange({ ...filters, accountId: v })}
        >
          <SelectTrigger className="w-[160px] text-sm">
            <SelectValue placeholder="All accounts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.type} onValueChange={(v) => onChange({ ...filters, type: v })}>
          <SelectTrigger className="w-[130px] text-sm">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="debit">Expense</SelectItem>
            <SelectItem value="credit">Income</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.categoryId}
          onValueChange={(v) => onChange({ ...filters, categoryId: v })}
        >
          <SelectTrigger className="w-[160px] text-sm">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="none">Uncategorised</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(INITIAL_FILTERS)}
            className="text-muted-foreground"
          >
            <X className="mr-1 h-3.5 w-3.5" /> Clear
          </Button>
        )}
      </div>

      {hasActive && (
        <div className="flex flex-wrap gap-1.5 text-xs">
          {filters.search && (
            <Badge
              variant="secondary"
              className="cursor-pointer"
              onClick={() => onChange({ ...filters, search: "" })}
            >
              "{filters.search}" ×
            </Badge>
          )}
          {filters.accountId !== "all" && (
            <Badge
              variant="secondary"
              className="cursor-pointer"
              onClick={() => onChange({ ...filters, accountId: "all" })}
            >
              {accounts.find((a) => a.id === filters.accountId)?.name ?? ""} ×
            </Badge>
          )}
          {filters.type !== "all" && (
            <Badge
              variant="secondary"
              className="cursor-pointer"
              onClick={() => onChange({ ...filters, type: "all" })}
            >
              {filters.type === "debit"
                ? "Expense"
                : filters.type === "credit"
                  ? "Income"
                  : "Transfer"}{" "}
              ×
            </Badge>
          )}
          {filters.categoryId !== "all" && (
            <Badge
              variant="secondary"
              className="cursor-pointer"
              onClick={() => onChange({ ...filters, categoryId: "all" })}
            >
              {filters.categoryId === "none"
                ? "Uncategorised"
                : (categories.find((c) => c.id === filters.categoryId)?.name ?? "")}{" "}
              ×
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

export { INITIAL_FILTERS };
