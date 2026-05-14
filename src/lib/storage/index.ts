import type { Account } from "@/features/accounts/types";
import { getDB } from "./db";
import { LocalRepository } from "./local-repository";
import type { Repository } from "./repository";

export type { Entity, ListQuery, Repository } from "./repository";

export interface Repositories {
  accounts: Repository<Account>;
}

let registry: Repositories | null = null;

export function getRepositories(): Repositories {
  if (!registry) {
    registry = {
      accounts: new LocalRepository<Account>(() => getDB().accounts),
    };
  }
  return registry;
}

export function resetRepositoriesForTests(): void {
  registry = null;
}
