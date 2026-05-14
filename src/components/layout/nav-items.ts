import {
  CircleDollarSign,
  CreditCard,
  Home,
  Landmark,
  LayoutGrid,
  type LucideIcon,
  PiggyBank,
  Settings,
  Tag,
  Wallet,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  group: "primary" | "secondary";
  mobile?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home, group: "primary", mobile: true },
  {
    href: "/transactions",
    label: "Transactions",
    icon: CreditCard,
    group: "primary",
    mobile: true,
  },
  { href: "/budgets", label: "Budgets", icon: Wallet, group: "primary", mobile: true },
  { href: "/accounts", label: "Accounts", icon: LayoutGrid, group: "primary", mobile: true },
  { href: "/categories", label: "Categories", icon: Tag, group: "primary" },
  { href: "/super", label: "Super", icon: PiggyBank, group: "secondary" },
  { href: "/mortgage", label: "Mortgage", icon: Landmark, group: "secondary" },
  { href: "/settings", label: "Settings", icon: Settings, group: "secondary" },
];

export const APP_NAME = "Budgy";
export const APP_MARK_ICON = CircleDollarSign;
