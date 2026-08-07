import test from 'node:test'
import assert from 'node:assert/strict'

import { formatMagicLinkError } from './login-errors.mjs'

test('explains an email rate limit and asks the user to wait', () => {
  assert.equal(
    formatMagicLinkError({ code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' }),
    'נשלחו יותר מדי קישורי כניסה בזמן קצר. המתינו כמה דקות ונסו שוב פעם אחת.'
  )
})

test('explains invalid email addresses', () => {
  assert.equal(
    formatMagicLinkError({ code: 'email_address_invalid', message: 'invalid email' }),
    'כתובת האימייל אינה תקינה. בדקו אותה ונסו שוב.'
  )
})

test('shows a safe diagnostic code for an unknown authentication error', () => {
  assert.equal(
    formatMagicLinkError({ code: 'smtp_failed', message: 'private provider details' }),
    'שליחת הקישור נכשלה. קוד תקלה: smtp_failed.'
  )
})

test('does not expose an unknown error message when no safe code exists', () => {
  assert.equal(
    formatMagicLinkError({ message: 'private provider details' }),
    'שליחת הקישור נכשלה. נסו שוב מאוחר יותר.'
  )
})
