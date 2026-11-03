import type { Table } from "dexie";
import type { Entity, ListQuery, Repository } from "./repository";

export class LocalRepository<T extends Entity> implements Repository<T> {
  constructor(private readonly table: () => Table<T, string>) {}

  async list(query: ListQuery<T> = {}): Promise<T[]> {
    let coll = this.table().toCollection();

    if (query.where) {
      const where = query.where;
      coll = coll.filter((row) =>
        Object.entries(where).every(([k, v]) => (row as Record<string, unknown>)[k] === v),
      );
    }

    let results = await coll.toArray();

    if (query.orderBy) {
      const key = query.orderBy as keyof T;
      const dir = query.direction === "desc" ? -1 : 1;
      results = results.sort((a, b) => {
        const av = a[key];
        const bv = b[key];
        if (av === bv) return 0;
        if (av == null) return -1 * dir;
        if (bv == null) return 1 * dir;
        return av < bv ? -1 * dir : 1 * dir;
      });
    }

    if (query.offset) results = results.slice(query.offset);
    if (query.limit != null) results = results.slice(0, query.limit);

    return results;
  }

  async get(id: string): Promise<T | null> {
    const row = await this.table().get(id);
    return row ?? null;
  }

  async upsert(entity: T): Promise<T> {
    await this.table().put(entity);
    return entity;
  }

  async bulkUpsert(entities: T[]): Promise<T[]> {
    await this.table().bulkPut(entities);
    return entities;
  }

  async delete(id: string): Promise<void> {
    await this.table().delete(id);
  }

  async count(query: ListQuery<T> = {}): Promise<number> {
    if (!query.where) return this.table().count();
    const rows = await this.list({ where: query.where });
    return rows.length;
  }
}
