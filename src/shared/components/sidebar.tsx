'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { UserNav } from '@/features/auth/components/user-nav'
import { type Role, getRoleLabel } from '@/shared/types/roles'
import {
  LayoutDashboard,
  Calendar,
  Users,
  Scissors,
  DollarSign,
  BarChart3,
  Settings,
  Clock,
  Ban,
} from 'lucide-react'

interface SidebarProps {
  professionalName: string
  isOwner: boolean
  role: Role
  storeName: string
  logoUrl?: string
}

const ownerLinks = [
  { href: '/bella-donna/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { href: '/bella-donna/calendario', label: 'Calendario', icon: Calendar },
  { href: '/bella-donna/profesionales', label: 'Profesionales', icon: Users },
  { href: '/bella-donna/tratamientos', label: 'Tratamientos', icon: Scissors },
  { href: '/bella-donna/turnos', label: 'Turnos', icon: Clock },
  { href: '/bella-donna/bloqueos', label: 'Licencias', icon: Ban },
  { href: '/bella-donna/liquidaciones', label: 'Liquidaciones', icon: DollarSign },
  { href: '/bella-donna/metricas', label: 'Métricas', icon: BarChart3 },
  { href: '/bella-donna/configuracion', label: 'Configuración', icon: Settings },
]

// Manager: same as owner but NO metrics and NO config
const managerLinks = [
  { href: '/bella-donna/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { href: '/bella-donna/calendario', label: 'Calendario', icon: Calendar },
  { href: '/bella-donna/profesionales', label: 'Profesionales', icon: Users },
  { href: '/bella-donna/tratamientos', label: 'Tratamientos', icon: Scissors },
  { href: '/bella-donna/turnos', label: 'Turnos', icon: Clock },
  { href: '/bella-donna/bloqueos', label: 'Licencias', icon: Ban },
  { href: '/bella-donna/liquidaciones', label: 'Liquidaciones', icon: DollarSign },
]

const professionalLinks = [
  { href: '/bella-donna/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { href: '/bella-donna/calendario', label: 'Mi Calendario', icon: Calendar },
  { href: '/bella-donna/turnos', label: 'Mis Turnos', icon: Clock },
  { href: '/bella-donna/bloqueos', label: 'Mis Licencias', icon: Ban },
  { href: '/bella-donna/liquidaciones', label: 'Mis Liquidaciones', icon: DollarSign },
]

function getLinksForRole(role: Role) {
  switch (role) {
    case 'owner': return ownerLinks
    case 'manager': return managerLinks
    case 'professional': return professionalLinks
  }
}

export function Sidebar({ professionalName, isOwner, role, storeName, logoUrl }: SidebarProps) {
  const pathname = usePathname()
  const links = getLinksForRole(role)
  const roleLabel = getRoleLabel(role)

  return (
    <aside className="w-64 border-r border-border bg-white/50 backdrop-blur-sm flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          {logoUrl && (
            <Image
              src={logoUrl}
              alt={storeName}
              width={36}
              height={36}
              className="w-9 h-9 rounded-lg object-contain"
            />
          )}
          <div>
            <h1 className="text-xl font-bold text-bella-rose-600">{storeName}</h1>
            <p className="text-xs text-muted-foreground">
              {role === 'owner' ? 'Panel de Administración' : role === 'manager' ? 'Panel Encargada' : 'Panel Profesional'}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {links.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(link.href + '/')
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-bella-rose-50 text-bella-rose-700'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <link.icon className="h-5 w-5" />
              {link.label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3">
          <UserNav name={professionalName} isOwner={isOwner} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{professionalName}</p>
            <p className="text-xs text-muted-foreground">{roleLabel}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
