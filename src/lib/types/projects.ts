export interface ProjectFile {
  id: string
  name: string
  description?: string | null
  file_type: string
  size_bytes?: number
  created_at?: string
  updated_at?: string
  sub_project_id?: string
  content?: string // Populated when loading for webhook
}

export interface SubProject {
  id: string
  project_id: string
  name: string
  description?: string | null
  icon?: string
  files?: ProjectFile[]
  files_count?: number
  created_at?: string
}

export interface Project {
  id: string
  user_id?: string
  name: string
  description?: string | null
  icon?: string
  color?: string
  sort_order?: number
  sub_projects?: SubProject[]
  sub_projects_count?: number
  total_files_count?: number
  created_at?: string
  updated_at?: string
}
