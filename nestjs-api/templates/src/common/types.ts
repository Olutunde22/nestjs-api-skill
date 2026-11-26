import type { PermissionKey } from './permissions';

export interface AuthenticatedUser {
  id: string;
  username: string;
  permissions: PermissionKey[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
