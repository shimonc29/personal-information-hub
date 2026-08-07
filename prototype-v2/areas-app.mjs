import { validateInformationArea } from './information-areas.mjs'
import { repository } from './product-context.mjs'
import { sessionReady } from './session-guard.mjs'

await sessionReady
const grid = document.querySelector('[data-areas-grid]')
const dialog = document.querySelector('[data-area-dialog]')
const form = document.querySelector('[data-area-form]')
const toast = document.querySelector('.toast')
let areas = []

function node(tag, className, text) { const element = document.createElement(tag); if (className) element.className = className; if (text != null) element.textContent = text; return element }
function notify(text) { toast.textContent = text; toast.classList.add('is-visible'); setTimeout(() => toast.classList.remove('is-visible'), 2600) }
function card(area) {
  const article = node('article', `area-card area-card--${area.tone}`)
  const icon = node('span', 'area-card__icon', area.icon)
  const copy = node('div'); copy.append(node('h2', '', area.name), node('p', '', area.description || 'אזור אישי שמחכה למסמכים שלך'))
  const link = node('a', '', 'בחירת מסמכים לאזור ←'); link.href = `./documents.html?area=${encodeURIComponent(area.id)}`
  article.append(icon, copy, link)
  return article
}
function render() {
  grid.replaceChildren(...areas.map(card))
  if (!areas.length) {
    const empty = node('section', 'area-empty'); empty.append(node('span', '', '◎'), node('h2', '', 'מתחילים מאזור אחד'), node('p', '', 'צרו אזור כמו משפחה, כספים או לימודים — ואחר כך בחרו אילו מסמכים שייכים אליו.'))
    const button = node('button', 'primary-button', 'יצירת אזור ראשון'); button.addEventListener('click', () => dialog.showModal()); empty.append(button); grid.append(empty)
  }
}
async function load() { try { areas = await repository.listInformationAreas(); render() } catch { grid.replaceChildren(node('p', 'task-empty', 'כדי להפעיל את אזורי המידע יש להשלים את עדכון מסד הנתונים.')) } }

document.querySelector('[data-new-area]').addEventListener('click', () => dialog.showModal())
document.querySelector('[data-area-close]').addEventListener('click', () => dialog.close())
document.querySelector('[data-area-cancel]').addEventListener('click', () => dialog.close())
form.addEventListener('submit', async (event) => {
  event.preventDefault(); const submit = form.querySelector('[type="submit"]'); submit.disabled = true
  try { const area = await repository.createInformationArea(validateInformationArea(Object.fromEntries(new FormData(form)))); areas.unshift(area); form.reset(); dialog.close(); render(); notify('אזור המידע נוצר') }
  catch { document.querySelector('[data-area-feedback]').textContent = 'לא הצלחנו ליצור את האזור. בדקו את הפרטים ונסו שוב.' }
  finally { submit.disabled = false }
})
load()
