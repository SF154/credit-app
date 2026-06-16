export function generateToken(): string {
  return crypto.randomUUID()
}

export function tokenExpiresAt(): Date {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d
}
