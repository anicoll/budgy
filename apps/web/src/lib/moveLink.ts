import { deflateSync, inflateSync, strFromU8, strToU8 } from "fflate";
import { MOVE_DICTIONARY_D2 } from "./moveDictionary";
import { parseSaved, SAVED_VERSION, type SavedData, type ToolKey } from "./saved";
import { b64urlDecode, b64urlEncode } from "./state";

/**
 * A link that carries everything saved on one device to another. The record
 * goes in the URL's `#` part, which browsers never send to a server, so the
 * numbers only travel inside the link itself.
 *
 * Format: `#<scheme>.<base64url>`.
 * - `d2` (what we make): each tool's inputs unpacked from their share-link
 *   base64 back to plain JSON, then deflated against a preset dictionary of
 *   a typical record. Base64 hides repeats from compression, and the
 *   dictionary means even a small record has something to point back to.
 *   A full household is around 250 to 400 characters.
 * - `d1`: plain deflate of the record. Older links, still read.
 * - `j1`: plain JSON. Older links, still read.
 *
 * Decoding runs the result through parseSaved, so a broken or tampered link
 * gives nothing rather than bad data.
 */

export const IMPORT_PATH = "/import/";

/** Longest fragment we'll try to read, well over a full save. */
const MAX_FRAGMENT = 200_000;

const DICT_D2 = strToU8(MOVE_DICTIONARY_D2);

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

// ── Packing a tool's query string ───────────────────────────────────────────
// Tools keep their inputs as a share-link query string, often with base64
// JSON values (sometimes nested). Packing turns `a=1&s=<base64 JSON>` into
// {"$q":[["a","1"],["s",{"$j":{…}}]]} so the JSON is visible to deflate.
// It is only used when unpacking gives back exactly the same string.

type Packed = unknown;

function packJson(x: unknown): Packed {
  if (typeof x === "string") return packValue(x);
  if (Array.isArray(x)) return x.map(packJson);
  if (x && typeof x === "object")
    return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, packJson(v)]));
  return x;
}

function unpackJson(x: Packed): unknown {
  if (Array.isArray(x)) return x.map(unpackJson);
  if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    if ("$q" in o || "$j" in o) return unpackValue(o);
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, unpackJson(v)]));
  }
  return x;
}

function packBase64Json(v: string): Packed | undefined {
  if (v.length < 8 || !/^[A-Za-z0-9_-]+$/.test(v)) return undefined;
  try {
    const text = b64urlDecode(v);
    if (b64urlEncode(text) !== v) return undefined;
    const json = JSON.parse(text);
    if (JSON.stringify(json) !== text) return undefined;
    return { $j: packJson(json) };
  } catch {
    return undefined;
  }
}

function packValue(s: string): Packed {
  const b64 = packBase64Json(s);
  if (b64) return b64;
  if (!s.includes("=")) return s;
  const pairs = s.split("&").map((kv) => {
    const i = kv.indexOf("=");
    return i < 0 ? null : [kv.slice(0, i), kv.slice(i + 1)];
  });
  if (!pairs.every(Boolean)) return s;
  return { $q: (pairs as string[][]).map(([k, v]) => [k, packBase64Json(v) ?? v]) };
}

function unpackValue(x: Packed): string {
  if (typeof x === "string") return x;
  if (!x || typeof x !== "object") throw new Error("bad packed value");
  const o = x as { $q?: unknown; $j?: unknown };
  if ("$j" in o) return b64urlEncode(JSON.stringify(unpackJson(o.$j)));
  if (!Array.isArray(o.$q)) throw new Error("bad packed value");
  return o.$q
    .map((pair) => {
      if (!Array.isArray(pair) || typeof pair[0] !== "string") throw new Error("bad pair");
      return `${pair[0]}=${unpackValue(pair[1])}`;
    })
    .join("&");
}

/** Pack a tool's query string, or leave it as it is when packing wouldn't round-trip. */
export function packQuery(query: string): Packed {
  const packed = packValue(query);
  try {
    return unpackValue(packed) === query ? packed : query;
  } catch {
    return query;
  }
}

export function unpackQuery(packed: Packed): string {
  return unpackValue(packed);
}

// ── The link ────────────────────────────────────────────────────────────────

/** The `#…` part of a move link for this record. */
export async function encodeMoveFragment(data: SavedData): Promise<string> {
  const { remember: _, ...rest } = data;
  const tools = Object.fromEntries(Object.entries(rest.tools).map(([k, q]) => [k, packQuery(q)]));
  const json = strToU8(JSON.stringify({ ...rest, tools }));
  return `d2.${toBase64Url(deflateSync(json, { level: 9, dictionary: DICT_D2 }))}`;
}

/** The full link, for the site at `origin`. */
export async function moveLink(data: SavedData, origin: string): Promise<string> {
  return `${origin}${IMPORT_PATH}#${await encodeMoveFragment(data)}`;
}

function readRecord(scheme: string, body: string): Record<string, unknown> | null {
  const bytes = fromBase64Url(body);
  if (scheme === "d2") {
    const raw = JSON.parse(strFromU8(inflateSync(bytes, { dictionary: DICT_D2 })));
    if (!raw || typeof raw !== "object") return null;
    const tools: Record<string, string> = {};
    if (raw.tools && typeof raw.tools === "object")
      for (const [k, p] of Object.entries(raw.tools)) tools[k] = unpackQuery(p);
    return { ...raw, tools };
  }
  if (scheme === "d1") return JSON.parse(strFromU8(inflateSync(bytes)));
  if (scheme === "j1") return JSON.parse(strFromU8(bytes));
  return null;
}

/** Read a move link's `#…` part. Null when it's empty, broken or not ours. */
export async function decodeMoveFragment(fragment: string): Promise<SavedData | null> {
  const text = fragment.replace(/^#/, "");
  if (!text || text.length > MAX_FRAGMENT) return null;
  const dot = text.indexOf(".");
  try {
    const raw = readRecord(text.slice(0, dot), text.slice(dot + 1));
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
