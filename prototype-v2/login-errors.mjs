export function formatMagicLinkError(error) {
  const code = typeof error?.code === 'string' ? error.code : ''
  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : ''

  if (code === 'over_email_send_rate_limit' || message.includes('rate limit')) {
    return 'נשלחו יותר מדי קישורי כניסה בזמן קצר. המתינו כמה דקות ונסו שוב פעם אחת.'
  }

  if (code === 'email_address_invalid' || message.includes('invalid email')) {
    return 'כתובת האימייל אינה תקינה. בדקו אותה ונסו שוב.'
  }

  if (code && /^[a-z0-9_]+$/i.test(code)) {
    return `שליחת הקישור נכשלה. קוד תקלה: ${code}.`
  }

  return 'שליחת הקישור נכשלה. נסו שוב מאוחר יותר.'
}
