import { parseSaved, SAVED_VERSION, type SavedData, type ToolKey } from "./saved";

/**
 * A link that carries everything saved on one device to another. The record
 * goes in the URL's `#` part, which browsers never send to a server, so the
 * numbers only travel inside the link itself.
 *
 * Format: `#<scheme>.<base64url>`. `d1` is deflate-raw compressed JSON (about
 * a quarter of the size); `j1` is plain JSON, for browsers without
 * CompressionStream. Decoding runs the result through parseSaved, so a broken
 * or tampered link gives nothing rather than bad data.
 */

export const IMPORT_PATH = "/import/";

/** Longest fragment we'll try to read, well over a full save. */
const MAX_FRAGMENT = 200_000;

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: GenericTransformStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

const canCompress = () =>
  typeof CompressionStream === "function" && typeof DecompressionStream === "function";

/** What a link carries: everything except the per-device "remember" switch. */
function payload(data: SavedData): Omit<SavedData, "remember"> {
  const { remember: _, ...rest } = data;
  return rest;
}

/** The `#…` part of a move link for this record. */
export async function encodeMoveFragment(data: SavedData): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(payload(data)));
  if (canCompress())
    return `d1.${toBase64Url(await pipe(json, new CompressionStream("deflate-raw")))}`;
  return `j1.${toBase64Url(json)}`;
}

/** The full link, for the site at `origin`. */
export async function moveLink(data: SavedData, origin: string): Promise<string> {
  return `${origin}${IMPORT_PATH}#${await encodeMoveFragment(data)}`;
}

/** Read a move link's `#…` part. Null when it's empty, broken or not ours. */
export async function decodeMoveFragment(fragment: string): Promise<SavedData | null> {
  const text = fragment.replace(/^#/, "");
  if (!text || text.length > MAX_FRAGMENT) return null;
  const dot = text.indexOf(".");
  const scheme = text.slice(0, dot);
  const body = text.slice(dot + 1);
  try {
    let bytes: Uint8Array;
    if (scheme === "d1" && canCompress())
      bytes = await pipe(fromBase64Url(body), new DecompressionStream("deflate-raw"));
    else if (scheme === "j1") bytes = fromBase64Url(body);
    else return null;
    const raw = JSON.parse(new TextDecoder().decode(bytes));
    if (!raw || typeof raw !== "object" || raw.v !== SAVED_VERSION) return null;
    // An imported record always remembers: the person asked to keep it.
    const data = parseSaved(JSON.stringify({ ...raw, remember: true }));
    return isEmpty(data) ? null : data;
  } catch {
    return null;
  }
}

export function isEmpty(data: SavedData): boolean {
  return (
    !data.profile &&
    Object.keys(data.loan).length === 0 &&
    Object.keys(data.tools).length === 0 &&
    data.people.every((p) => Object.keys(p).length === 0)
  );
}

/** A short list of what a record holds, to show before importing it. */
export function describeSaved(data: SavedData, toolName: (t: ToolKey) => string): string[] {
  const out: string[] = [];
  if (data.profile) out.push("Your answers from the home page");
  if (data.loan.balance) out.push("Your home loan");
  const named = data.people.filter((p) => p.name || p.salary);
  if (named.length)
    out.push(
      named.length === 1
        ? `${named[0].name ?? "One person"}'s pay details`
        : `${named.length} people's pay details`,
    );
  const tools = Object.keys(data.tools) as ToolKey[];
  if (tools.length)
    out.push(
      `Inputs for ${tools.length === 1 ? "1 tool" : `${tools.length} tools`}: ${tools.map(toolName).join(", ")}`,
    );
  return out;
}
