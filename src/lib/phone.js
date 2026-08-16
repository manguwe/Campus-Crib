// Centralised phone-number formatting so every place that renders a
// Call/SMS/WhatsApp link (ContactLandlordButton, PropertyContactsManager,
// PhoneContactLinks) normalises numbers the same way.

/** Strips everything except digits and a leading +, so tel:/sms: links
 * work even if the stored number has spaces/dashes/brackets. */
export function toUriPhone(phone) {
  if (!phone) return ''
  const trimmed = phone.trim()
  const hasPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/[^\d]/g, '')
  return hasPlus ? `+${digits}` : digits
}

/**
 * wa.me links need bare digits in international format, no leading +
 * or 0. Zambian numbers are commonly entered as 09XXXXXXXX (local) or
 * +2609XXXXXXXX / 2609XXXXXXXX (international) - this normalises any of
 * those (and falls through unchanged for anything else already in
 * international form) to what wa.me expects.
 */
export function toWhatsAppNumber(phone) {
  if (!phone) return ''
  let digits = phone.trim().replace(/[^\d]/g, '')

  if (digits.startsWith('260')) {
    return digits
  }
  if (digits.startsWith('0')) {
    return `260${digits.slice(1)}`
  }
  // 9-digit local number typed without the leading 0 (e.g. "97xxxxxxx")
  if (digits.length === 9) {
    return `260${digits}`
  }
  return digits
}

export function telLink(phone) {
  return `tel:${toUriPhone(phone)}`
}

export function smsLink(phone) {
  return `sms:${toUriPhone(phone)}`
}

export function whatsappLink(phone) {
  return `https://wa.me/${toWhatsAppNumber(phone)}`
}
