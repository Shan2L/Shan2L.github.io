const modules = import.meta.glob('./posts/*.md', { eager: true })

// Front matter dates look like "2026-3-15 18:14", which Safari's Date parser rejects.
function parseDate(value) {
  if (value instanceof Date) return value
  const m = String(value ?? '').match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}

export const posts = Object.entries(modules)
  .map(([path, mod]) => {
    const fileName = path.split('/').pop()
    return {
      fileName,
      title: mod.attributes?.title || fileName,
      date: parseDate(mod.attributes?.date),
    }
  })
  .filter((p) => p.date)
  .sort((a, b) => b.date - a.date)

export function formatDate(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
