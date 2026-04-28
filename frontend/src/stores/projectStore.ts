import { create } from 'zustand'
import { projectApi, type Project, type ProjectCreate, type ProjectUpdate } from '@/lib/api'

interface ProjectState {
  projects: Project[]
  loading: boolean
  error: string | null

  fetchProjects: () => Promise<void>
  createProject: (data: ProjectCreate) => Promise<Project>
  updateProject: (id: string, data: ProjectUpdate) => Promise<Project>
  deleteProject: (id: string) => Promise<void>
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  loading: false,
  error: null,

  fetchProjects: async () => {
    set({ loading: true, error: null })
    try {
      const projects = await projectApi.list()
      set({ projects, loading: false })
    } catch (err: any) {
      set({ error: err.message || '加载项目失败', loading: false })
    }
  },

  createProject: async (data) => {
    set({ loading: true, error: null })
    try {
      const project = await projectApi.create(data)
      set((s) => ({ projects: [project, ...s.projects], loading: false }))
      return project
    } catch (err: any) {
      set({ error: err.message || '创建项目失败', loading: false })
      throw err
    }
  },

  updateProject: async (id, data) => {
    set({ loading: true, error: null })
    try {
      const project = await projectApi.update(id, data)
      set((s) => ({
        projects: s.projects.map((p) => (p.id === id ? project : p)),
        loading: false,
      }))
      return project
    } catch (err: any) {
      set({ error: err.message || '更新项目失败', loading: false })
      throw err
    }
  },

  deleteProject: async (id) => {
    set({ loading: true, error: null })
    try {
      await projectApi.delete(id)
      set((s) => ({
        projects: s.projects.filter((p) => p.id !== id),
        loading: false,
      }))
    } catch (err: any) {
      set({ error: err.message || '删除项目失败', loading: false })
      throw err
    }
  },
}))
