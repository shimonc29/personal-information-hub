import { createAuthClient } from './auth-client.mjs'
import { formatMagicLinkError } from './login-errors.mjs'
import { loadRuntimeConfig } from './runtime-config.mjs'

const form = document.querySelector('[data-login-form]')
const status = document.querySelector('[data-login-status]')
let auth

function showRetry(message) {
  status.textContent = message
  form.hidden = true
  const retry = document.createElement('button')
  retry.type = 'button'
  retry.className = 'primary-button'
  retry.textContent = 'נסו שוב'
  retry.addEventListener('click', () => location.reload())
  status.after(retry)
}

try {
  const config = await loadRuntimeConfig()
  if (config.mode === 'development') location.replace('./index.html')
  auth = createAuthClient({ url: config.supabaseUrl, anonKey: config.supabaseAnonKey, storage: localStorage, createClientImpl: globalThis.supabase?.createClient })
  const session = await auth.initialize((_event, nextSession) => { if (nextSession) location.replace('./onboarding.html') })
  if (session) location.replace('./onboarding.html')
} catch (error) {
  console.error('Authentication initialization failed', error)
  showRetry('לא הצלחנו לטעון את החיבור או להכין את החשבון.')
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  if (!auth) return showRetry('החיבור עדיין אינו זמין.')
  const button = form.querySelector('button')
  const email = new FormData(form).get('email')?.toString().trim()
  button.disabled = true
  status.textContent = 'שולחים קישור מאובטח…'
  try {
    await auth.sendMagicLink(email, new URL('/login.html', location.origin).href)
    form.hidden = true
    status.textContent = 'הקישור נשלח. אפשר לפתוח אותו בלשונית חדשה באותו דפדפן.'
  } catch (error) {
    button.disabled = false
    console.error('Magic-link request failed', error)
    status.textContent = formatMagicLinkError(error)
  }
})
