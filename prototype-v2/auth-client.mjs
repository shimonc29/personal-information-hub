const seededPrefix = 'personal-hub.seeded:'

function throwIfError(result) {
  if (result?.error) throw result.error
  return result
}

export function createAuthClient({ url, anonKey, storage, createClientImpl = globalThis.supabase?.createClient } = {}) {
  if (!storage) throw new Error('Explicit session storage is required')
  if (typeof createClientImpl !== 'function') throw new Error('Official Supabase SDK is not loaded')
  const client = createClientImpl(url, anonKey, { auth: { flowType: 'pkce', persistSession: true, storage, detectSessionInUrl: true } })
  const pendingSeeds = new Map()

  async function getSession() {
    const { data, error } = await client.auth.getSession()
    if (error) throw error
    return data.session
  }

  async function ensureSeeded(session) {
    const userId = session?.user?.id
    if (!userId || storage.getItem(`${seededPrefix}${userId}`)) return
    if (!pendingSeeds.has(userId)) {
      pendingSeeds.set(userId, (async () => {
        throwIfError(await client.rpc('seed_my_sample_projects'))
        storage.setItem(`${seededPrefix}${userId}`, '1')
      })().finally(() => pendingSeeds.delete(userId)))
    }
    return pendingSeeds.get(userId)
  }

  return {
    async initialize(onChange) {
      client.auth.onAuthStateChange((event, session) => {
        onChange?.(event, session)
        if (session) queueMicrotask(() => ensureSeeded(session).catch(() => {}))
      })
      const session = await getSession()
      if (session) await ensureSeeded(session)
      return session
    },
    getSession,
    async getAccessToken() { return (await getSession())?.access_token ?? null },
    ensureSeeded,
    async sendMagicLink(email, emailRedirectTo) { throwIfError(await client.auth.signInWithOtp({ email, options: { emailRedirectTo } })) },
    async signOut() { throwIfError(await client.auth.signOut()) },
  }
}
