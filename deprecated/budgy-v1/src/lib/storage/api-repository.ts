import type { Entity, ListQuery, Repository } from "./repository";

const NOT_READY = "ApiRepository is a Phase 2 placeholder — backend not implemented yet";

export class ApiRepository<T extends Entity> implements Repository<T> {
  constructor(private readonly resource: string) {
    void this.resource;
  }
  list(_query?: ListQuery<T>): Promise<T[]> {
    return Promise.reject(new Error(NOT_READY));
  }
  get(_id: string): Promise<T | null> {
    return Promise.reject(new Error(NOT_READY));
  }
  upsert(_entity: T): Promise<T> {
    return Promise.reject(new Error(NOT_READY));
  }
  bulkUpsert(_entities: T[]): Promise<T[]> {
    return Promise.reject(new Error(NOT_READY));
  }
  delete(_id: string): Promise<void> {
    return Promise.reject(new Error(NOT_READY));
  }
  count(_query?: ListQuery<T>): Promise<number> {
    return Promise.reject(new Error(NOT_READY));
  }
}
