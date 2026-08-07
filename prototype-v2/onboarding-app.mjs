import { buildOnboardingProgress } from './onboarding.mjs'
import { auth, config, repository } from './product-context.mjs'
import { sessionReady } from './session-guard.mjs'

await sessionReady

const progressBox = document.querySelector('[data-onboarding-progress]')
const progressLabel = document.querySelector('[data-progress-label]')
const progressCount = document.querySelector('[data-progress-count]')
const progressBar = document.querySelector('[data-progress-bar]')
const errorBox = document.querySelector('[data-onboarding-error]')
const readyBox = document.querySelector('[data-onboarding-ready]')
const steps = {
  connect: document.querySelector('[data-onboarding-connect]'),
  scan: document.querySelector('[data-onboarding-scan]'),
  organize: document.querySelector('[data-onboarding-organize]'),
}

async function api(path, options = {}) {
  if (config.mode === 'development') return path.endsWith('/status') ? { connected: false } : { files: [] }
  const token = await auth.getAccessToken()
  if (!token) throw new Error('נדרשת התחברות מחדש')
  const response = await fetch(path, { ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers } })
  const result = await response.json()
  if (!response.ok) throw new Error(result?.error || 'הפעולה נכשלה')
  return result
}

function render({ connected, fileCount, areaCount }) {
  const progress = buildOnboardingProgress({ connected, fileCount, areaCount })
  progressCount.textContent = `${progress.completed} מתוך ${progress.total}`
  progressBar.style.width = `${progress.completed / progress.total * 100}%`
  progressLabel.textContent = progress.ready ? 'המרכז האישי מוכן' : 'עוד צעד קטן והכול מתחבר'
  for (const [name, element] of Object.entries(steps)) {
    const order = ['connect', 'scan', 'organize'].indexOf(name)
    element.classList.toggle('is-complete', order < progress.completed)
    element.classList.toggle('is-current', name === progress.current)
  }
  steps.scan.querySelector('[data-scan-copy]').textContent = fileCount ? `מצאנו ${fileCount} פריטים בסריקה הראשונה.` : 'נספור סוגי קבצים ונזהה מה מחכה לסדר.'
  steps.organize.querySelector('[data-area-copy]').textContent = areaCount ? `כבר יצרת ${areaCount} אזורי מידע אישיים.` : 'משפחה, כספים, לימודים או כל תחום שמתאים לחיים שלך.'
  readyBox.hidden = !progress.ready
  progressBox.classList.toggle('is-ready', progress.ready)
}

async function load() {
  errorBox.textContent = ''
  const status = await api('/api/connections/google/status')
  const [areas, drive] = await Promise.all([
    repository.listInformationAreas(),
    status.connected ? api('/api/drive/files') : Promise.resolve({ files: [] }),
  ])
  render({ connected: status.connected, fileCount: drive.files?.length ?? 0, areaCount: areas.length })
}

document.querySelector('[data-connect-action]').addEventListener('click', async () => {
  try {
    const { url } = await api('/api/connections/google/start', { method: 'POST' })
    location.assign(url)
  } catch (error) { errorBox.textContent = error.message }
})

load().catch((error) => {
  errorBox.textContent = 'לא הצלחנו לבדוק את מצב ההתחלה. אפשר לרענן ולנסות שוב.'
  console.error('Onboarding initialization failed', error)
})
