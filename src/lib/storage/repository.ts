export interface Entity {
  id: string;
}

export interface ListQuery<T> {
  where?: Partial<T>;
  orderBy?: keyof T;
  direction?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface Repository<T extends Entity> {
  list(query?: ListQuery<T>): Promise<T[]>;
  get(id: string): Promise<T | null>;
  upsert(entity: T): Promise<T>;
  bulkUpsert(entities: T[]): Promise<T[]>;
  delete(id: string): Promise<void>;
  count(query?: ListQuery<T>): Promise<number>;
}
