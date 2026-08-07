export async function loadRuntimeConfig(fetchImpl = fetch) {
  const response = await fetchImpl('./api/config')
  if (!response.ok) throw new Error('Production connection is not configured')
  const config = await response.json()
  if (config.mode === 'development') return config
  if (!config.supabaseUrl || !config.supabaseAnonKey) throw new Error('Production connection is not configured')
  return config
}
