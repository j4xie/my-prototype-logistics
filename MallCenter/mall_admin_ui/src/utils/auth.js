import Cookies from 'js-cookie'

const TokenKey = 'Admin-Token'

export const userKey = 'user-info'
export const multipleTabsKey = 'multiple-tabs'

export function getToken() {
  return Cookies.get(TokenKey)
}

export function setToken(token) {
  return Cookies.set(TokenKey, token)
}

export function removeToken() {
  return Cookies.remove(TokenKey)
}

export function formatToken(token) {
  return 'Bearer ' + token
}

export function hasPerms(value) {
  if (!value) return false
  const permissions = JSON.parse(sessionStorage.getItem('permissions') || '[]')
  if (typeof value === 'string') return permissions.includes(value)
  if (Array.isArray(value)) return value.some(v => permissions.includes(v))
  return false
}
