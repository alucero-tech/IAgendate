export type Role = 'professional' | 'manager' | 'owner'

// Owner can do everything manager can, manager can do everything professional can
const ROLE_HIERARCHY: Record<Role, number> = {
  professional: 0,
  manager: 1,
  owner: 2,
}

export function hasMinRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

export function getRoleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    professional: 'Profesional',
    manager: 'Encargada',
    owner: 'Dueña',
  }
  return labels[role]
}
