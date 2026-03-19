'use client'

import { useState, useEffect } from 'react'
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
  Menu,
  X,
  CreditCard,
} from 'lucide-react'

interface SidebarProps {
  professionalName: string
  isOwner: boolean
  role: Role
  storeName: string
  logoUrl?: string
  slug: string
}

function getLinksForRole(role: Role, slug: string) {
  const base = `/${slug}/admin`
  const ownerLinks = [
    { href: `${base}/dashboard`, label: 'Inicio', icon: LayoutDashboard },
    { href: `${base}/calendario`, label: 'Calendario', icon: Calendar },
    { href: `${base}/profesionales`, label: 'Profesionales', icon: Users },
    { href: `${base}/tratamientos`, label: 'Tratamientos', icon: Scissors },
    { href: `${base}/turnos`, label: 'Turnos', icon: Clock },
    { href: `${base}/bloqueos`, label: 'Licencias', icon: Ban },
    { href: `${base}/liquidaciones`, label: 'Liquidaciones', icon: DollarSign },
    { href: `${base}/metricas`, label: 'Métricas', icon: BarChart3 },
    { href: `${base}/configuracion`, label: 'Configuración', icon: Settings },
    { href: `${base}/suscripcion`, label: 'Suscripción', icon: CreditCard },
  ]
  const managerLinks = [
    { href: `${base}/dashboard`, label: 'Inicio', icon: LayoutDashboard },
    { href: `${base}/calendario`, label: 'Calendario', icon: Calendar },
    { href: `${base}/profesionales`, label: 'Profesionales', icon: Users },
    { href: `${base}/tratamientos`, label: 'Tratamientos', icon: Scissors },
    { href: `${base}/turnos`, label: 'Turnos', icon: Clock },
    { href: `${base}/bloqueos`, label: 'Licencias', icon: Ban },
    { href: `${base}/liquidaciones`, label: 'Liquidaciones', icon: DollarSign },
  ]
  const professionalLinks = [
    { href: `${base}/dashboard`, label: 'Inicio', icon: LayoutDashboard },
    { href: `${base}/calendario`, label: 'Mi Calendario', icon: Calendar },
    { href: `${base}/turnos`, label: 'Mis Turnos', icon: Clock },
    { href: `${base}/bloqueos`, label: 'Mis Licencias', icon: Ban },
    { href: `${base}/liquidaciones`, label: 'Mis Liquidaciones', icon: DollarSign },
  ]

  switch (role) {
    case 'owner': return ownerLinks
    case 'manager': return managerLinks
    case 'professional': return professionalLinks
  }
}

export function Sidebar({ professionalName, isOwner, role, storeName, logoUrl, slug }: SidebarProps) {
  const pathname = usePathname()
  const links = getLinksForRole(role, slug)
  const roleLabel = getRoleLabel(role)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center justify-between">
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
          {/* Close button - mobile only */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-2 -mr-2 rounded-lg hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
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
    </>
  )

  return (
    <>
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-b border-border h-14 flex items-center px-4 gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-2 rounded-lg hover:bg-muted"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          {logoUrl && (
            <Image
              src={logoUrl}
              alt={storeName}
              width={28}
              height={28}
              className="w-7 h-7 rounded-lg object-contain"
            />
          )}
          <span className="font-bold text-bella-rose-600">{storeName}</span>
        </div>
        <UserNav name={professionalName} isOwner={isOwner} />
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          'lg:hidden fixed top-0 left-0 bottom-0 z-50 w-72 bg-white flex flex-col transition-transform duration-300 ease-in-out shadow-2xl',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 border-r border-border bg-white/50 backdrop-blur-sm flex-col">
        {sidebarContent}
      </aside>
    </>
  )
}
