// Curated Google Fonts (no API key needed to *load* a font's CSS).
export const GOOGLE_FONTS = [
  'Fraunces', 'Playfair Display', 'Cormorant Garamond', 'EB Garamond', 'Spectral',
  'Bodoni Moda', 'Libre Baskerville', 'Crimson Pro', 'Lora', 'Syne',
  'Inter', 'Manrope', 'DM Sans', 'Poppins', 'Montserrat', 'Work Sans',
  'Space Grotesk', 'Archivo', 'Sora', 'Outfit', 'Epilogue', 'Bricolage Grotesque',
  'IBM Plex Sans', 'Josefin Sans', 'Libre Franklin', 'Plus Jakarta Sans',
]

const loaded = new Set()
export function loadFont(name) {
  if (!name || loaded.has(name)) return
  loaded.add(name)
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, '+')}:wght@400;500;600;700&display=swap`
  document.head.appendChild(link)
}
