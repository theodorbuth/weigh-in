import { useOutletContext } from 'react-router'
import type { ProjectData } from './project'

export interface ProjectContext {
  data: ProjectData
  reload: () => Promise<void>
  /** The viewer's users.id */
  me: number
}

export function useProjectContext() {
  return useOutletContext<ProjectContext>()
}
