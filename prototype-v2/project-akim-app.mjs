import { createDashboardModel, createFollowUpTask } from './dashboard-model.mjs'

window.addEventListener('DOMContentLoaded', () => {
  let model = createDashboardModel()
  const button = document.querySelector('[data-action="create-follow-up"]')
  const toast = document.querySelector('.toast')

  button.addEventListener('click', () => {
    model = createFollowUpTask(model, 'akim')
    button.disabled = true
    button.innerHTML = '<span>✓</span> משימת המעקב נוצרה'
    toast.textContent = model.toast
    toast.classList.add('is-visible')
  })

  document.querySelectorAll('[data-tab]').forEach((tab) => tab.addEventListener('click', () => {
    document.querySelectorAll('[data-tab]').forEach((item) => item.classList.toggle('is-active', item === tab))
  }))
})
