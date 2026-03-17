'use client'

import { logoutAction } from '../services/auth-actions'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { LogOut, User } from 'lucide-react'

interface UserNavProps {
  name: string
  isOwner: boolean
}

export function UserNav({ name, isOwner }: UserNavProps) {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10 border-2 border-bella-rose-200">
            <AvatarFallback className="bg-bella-rose-100 text-bella-rose-700 font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="flex items-center gap-2 p-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <div className="flex flex-col">
            <p className="text-sm font-medium">{name}</p>
            <p className="text-xs text-muted-foreground">
              {isOwner ? 'Administradora' : 'Profesional'}
            </p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <form action={logoutAction} className="w-full">
            <button type="submit" className="flex w-full items-center gap-2 text-red-600">
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
