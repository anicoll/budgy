import type { Metadata } from "next";
import { ImportView } from "@/components/ImportView";

export const metadata: Metadata = {
  title: "Bring your numbers across",
  description: "Open a link from another device to bring your saved budgy numbers onto this one.",
  robots: { index: false, follow: true },
};

export default function ImportPage() {
  return <ImportView />;
}
