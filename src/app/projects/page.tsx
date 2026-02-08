/**
 * Projects Page
 *
 * Main page for managing user projects
 */

import { ProjectsView } from '@/components/projects/ProjectsView'

export default function ProjectsPage() {
  return (
    <div className="h-full flex flex-col">
      <ProjectsView />
    </div>
  )
}
