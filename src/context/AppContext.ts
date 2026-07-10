import { createContext, useContext } from 'react'
import type { Profile, Screen } from '../types'

export interface ModalConfig {
  title: string
  body: React.ReactNode
  footer?: React.ReactNode
  wide?: boolean
}

export interface AppCtx {
  profile: Profile | null
  role: string
  permissions: string[]
  navigate: (screen: Screen, params?: Record<string, string>) => void
  screen: Screen
  params: Record<string, string>
  toast: (msg: string) => void
  openModal: (config: ModalConfig) => void
  closeModal: () => void
}

export const AppContext = createContext<AppCtx>({
  profile: null,
  role: '',
  permissions: [],
  navigate: () => {},
  screen: 'dashboard',
  params: {},
  toast: () => {},
  openModal: () => {},
  closeModal: () => {},
})

export const useApp = () => useContext(AppContext)
