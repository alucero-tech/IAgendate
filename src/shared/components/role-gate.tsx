'use client'

import { type Role, hasMinRole } from '@/shared/types/roles'

interface RoleGateProps {
  role: Role
  minRole: Role
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function RoleGate({ role, minRole, children, fallback = null }: RoleGateProps) {
  if (!hasMinRole(role, minRole)) return <>{fallback}</>
  return <>{children}</>
}
