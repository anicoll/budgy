import { ulid as ulidx } from "ulidx";

export function ulid(): string {
  return ulidx();
}
