const OK = ['H1', 'H2', 'H3', 'P', 'UL', 'OL', 'LI', 'B', 'STRONG', 'I', 'EM', 'BR', 'DIV', 'SPAN']
export function clean(h: string) {
  const d = new DOMParser().parseFromString(h, 'text/html')
    d.body.querySelectorAll('*').forEach(e => { if (!OK.includes(e.tagName)) e.remove(); else Array.from(e.attributes).forEach(a => e.removeAttribute(a.name)) })
  return d.body.innerHTML
}
export function printDoc(html: string, photo: string | null, title: string) {
  const w = window.open('', '_blank')
  if (!w) return alert('Allow pop-ups, then choose "Save as PDF" in the print dialog.')
  const t = title.replace(/[<>&]/g, '')
  w.document.write(`<!doctype html><title>${t}</title><style>body{font:11pt/1.45 Arial,sans-serif;margin:18mm;color:#111}h1{font-size:20pt;margin:0 0 4px}h2{font-size:12pt;border-bottom:1px solid #999;margin:14px 0 6px;padding-bottom:2px}ul{margin:4px 0 4px 18px;padding:0}p{margin:4px 0}img{float:right;width:30mm;height:40mm;object-fit:cover;margin:0 0 8px 12px}</style>${photo ? `<img src="${photo}">` : ''}${clean(html)}`)
  w.document.close(); setTimeout(() => w.print(), 700)
}
