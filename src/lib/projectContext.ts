import { useOutletContext } from 'react-router'
import type { ProjectData, RemoteDrag } from './project'

export interface ProjectContext {
  data: ProjectData
  reload: () => Promise<void>
  /** The viewer's users.id */
  me: number
  /** Teammates' in-progress drags (rebalancing) and a way to share mine. */
  remoteDrags: RemoteDrag[]
  sendDrag: (d: RemoteDrag & { done?: boolean }) => void
}

export function useProjectContext() {
  return useOutletContext<ProjectContext>()
}
