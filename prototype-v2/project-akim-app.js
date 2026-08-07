import { repository } from './product-context.mjs'
import { sessionReady } from './session-guard.mjs'

await sessionReady
const button = document.querySelector('[data-action="create-follow-up"]')
const toast = document.querySelector('.toast')
button.addEventListener('click', async () => {
  button.disabled = true
  try {
    await repository.createTask({ projectId: 'akim', title: 'מעקב אחר הצעת המחיר', dueLabel: 'היום', priority: 'גבוהה' })
    button.textContent = '✓ משימת המעקב נוצרה'; toast.textContent = 'משימת המעקב נוצרה'
  } catch { button.disabled = false; button.textContent = 'נסה שוב'; toast.textContent = 'לא הצלחנו ליצור את המשימה.' }
  toast.classList.add('is-visible')
})
document.querySelectorAll('[data-tab]').forEach((tab) => tab.addEventListener('click', () => document.querySelectorAll('[data-tab]').forEach((item) => item.classList.toggle('is-active', item === tab))))
