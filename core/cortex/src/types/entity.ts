export interface Entity<T> {
  id: string;
  object: T;
  remotes?: string[];
}

export function recognizeEntity(object: any): object is Entity<any> {
  const entity = object as Entity<any>;
  return (typeof object === 'object' &&
    entity.id !== undefined &&
    typeof entity.id === 'string' &&
    entity.object !== null) as boolean;
}
