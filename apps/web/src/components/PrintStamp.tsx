"use client";

import { useEffect, useState } from "react";

/**
 * A line that only shows on paper: where the page came from and when, so a
 * printed result can be opened again with the same inputs.
 */
export function PrintStamp() {
  const [stamp, setStamp] = useState("");
  useEffect(() => {
    const set = () => {
      const when = new Date().toLocaleDateString("en-AU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      setStamp(`Printed ${when} from ${window.location.href}`);
    };
    set();
    window.addEventListener("beforeprint", set);
    return () => window.removeEventListener("beforeprint", set);
  }, []);
  if (!stamp) return null;
  return <p className="hidden w-full break-all print:block">{stamp}</p>;
}
