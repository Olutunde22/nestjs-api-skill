// OPTIONAL (decision gate 5): the permission registry. Every key here must also be seeded,
// or it is a permission nobody can be granted.
export const PERMISSIONS = {
  THINGS_READ: 'things:read',
  THINGS_WRITE: 'things:write',
  AUDIT_READ: 'audit:read',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: { key: PermissionKey; description: string }[] = [
  { key: PERMISSIONS.THINGS_READ, description: 'View things' },
  { key: PERMISSIONS.THINGS_WRITE, description: 'Create, update and delete things' },
  { key: PERMISSIONS.AUDIT_READ, description: 'View the audit log' },
];
