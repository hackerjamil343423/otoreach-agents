export interface ProjectFile {
  id: string
  name: string
  file_type: string
  size_bytes?: number
  updated_at?: string
  sub_project_id?: string
}

export interface SubProject {
  id: string
  name: string
  files?: ProjectFile[]
}

export interface Project {
  id: string
  name: string
  color?: string
  sub_projects?: SubProject[]
}
