import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TOOLS } from "./tools";

const SRC = path.resolve(__dirname, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) && !name.includes(".test.") ? [full] : [];
  });
}

describe("internal links", () => {
  // GitHub Pages serves each page at <route>/ and redirects <route> to it.
  // Google reports links to the bare <route> as redirect errors, so every
  // relative link to a page has to end in a slash.
  it("link to the trailing-slash form of every page", () => {
    const routes = [...TOOLS.map((t) => t.href.slice(1)), "privacy", "import"];
    const bare = new RegExp(`\\.\\./(${routes.join("|")})(?![\\w/-])`, "g");
    const offenders = sourceFiles(SRC).flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(bare)].map(
        (m) => `${path.relative(SRC, file)}: ${m[0]}`,
      ),
    );
    expect(offenders).toEqual([]);
  });
});
