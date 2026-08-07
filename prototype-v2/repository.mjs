import { createSupabaseRepository } from './supabase-repository.mjs'

export function createRepository({ mode, localStore, supabase }) {
  if (mode === 'development') {
    if (!localStore) throw new Error('A local store is required in development')
    return { kind: 'development-local', ...localStore }
  }
  if (!supabase) throw new Error('Supabase configuration is required outside development')
  return { kind: 'supabase', ...createSupabaseRepository(supabase) }
}
