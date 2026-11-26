import { createContext, useContext } from 'react'

export const StaffShellContext = createContext({
  openAjustes: () => {},
  goLectorQr: () => {},
})

export function useStaffShell() {
  return useContext(StaffShellContext)
}