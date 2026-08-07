import { createAuthClient } from './auth-client.mjs'
import { createBrowserRepository } from './browser-repository.mjs'
import { loadRuntimeConfig } from './runtime-config.mjs'

export const config = await loadRuntimeConfig()
async function loadSupabaseSdk() {
  if (globalThis.supabase?.createClient) return globalThis.supabase.createClient
  await new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = './vendor/supabase.js'
    script.onload = resolve
    script.onerror = () => reject(new Error('Official Supabase SDK failed to load'))
    document.head.append(script)
  })
  return globalThis.supabase?.createClient
}

const createClientImpl = config.mode === 'development' ? null : await loadSupabaseSdk()
export const auth = config.mode === 'development' ? null : createAuthClient({ url: config.supabaseUrl, anonKey: config.supabaseAnonKey, storage: localStorage, createClientImpl })
export const repository = createBrowserRepository({ config, getAccessToken: () => auth?.getAccessToken() })
