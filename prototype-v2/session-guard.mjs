import { auth, config } from './product-context.mjs'

async function guard() {
  if (config.mode === 'development') return
  let session
  try {
    session = await auth.initialize()
  } catch {
    const panel = document.createElement('section')
    panel.className = 'auth-card'
    panel.innerHTML = '<h1>לא הצלחנו לטעון את החשבון</h1><p>החיבור או יצירת נתוני ההתחלה נכשלו.</p>'
    const retry = document.createElement('button')
    retry.className = 'primary-button'; retry.textContent = 'נסה שוב'; retry.addEventListener('click', () => location.reload())
    panel.append(retry); document.body.replaceChildren(panel)
    await new Promise(() => {})
  }
  if (!session) {
    location.replace('./login.html')
    await new Promise(() => {})
  }
  const button = document.querySelector('.profile-card button')
  if (button) {
    button.textContent = 'יציאה'
    button.setAttribute('aria-label', 'יציאה מהחשבון')
    button.addEventListener('click', async () => { await auth.signOut(); location.replace('./login.html') })
  }
}

export const sessionReady = guard()
