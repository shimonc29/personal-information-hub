export function loadProductConfig(environment = process.env) {
  const mode = environment.PRODUCT_MODE
  if (!mode) throw new Error('PRODUCT_MODE must be set explicitly')
  if (!['development', 'production'].includes(mode)) throw new Error('PRODUCT_MODE must be development or production')

  const config = {
    mode,
    supabaseUrl: environment.SUPABASE_URL?.replace(/\/$/, ''),
    supabaseAnonKey: environment.SUPABASE_PUBLISHABLE_KEY ?? environment.SUPABASE_ANON_KEY,
  }
  if (mode === 'production' && (!config.supabaseUrl || !config.supabaseAnonKey)) {
    throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required in production')
  }
  return config
}
