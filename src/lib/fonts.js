// Curated Google Fonts catalog (no API key needed to *load* a font's CSS).
// { name, cat }  cat ∈ serif | sans | display | mono | script
export const FONTS = [
  // — Serif —
  { name: 'Playfair Display', cat: 'serif' }, { name: 'Fraunces', cat: 'serif' },
  { name: 'Cormorant Garamond', cat: 'serif' }, { name: 'EB Garamond', cat: 'serif' },
  { name: 'Lora', cat: 'serif' }, { name: 'Merriweather', cat: 'serif' },
  { name: 'PT Serif', cat: 'serif' }, { name: 'Source Serif 4', cat: 'serif' },
  { name: 'Libre Baskerville', cat: 'serif' }, { name: 'Crimson Pro', cat: 'serif' },
  { name: 'Spectral', cat: 'serif' }, { name: 'Bitter', cat: 'serif' },
  { name: 'Domine', cat: 'serif' }, { name: 'Zilla Slab', cat: 'serif' },
  { name: 'Bodoni Moda', cat: 'serif' }, { name: 'Cardo', cat: 'serif' },
  { name: 'Noto Serif', cat: 'serif' }, { name: 'Vollkorn', cat: 'serif' },
  { name: 'Alegreya', cat: 'serif' }, { name: 'Newsreader', cat: 'serif' },
  { name: 'DM Serif Display', cat: 'serif' }, { name: 'Marcellus', cat: 'serif' },
  { name: 'Cormorant', cat: 'serif' }, { name: 'Petrona', cat: 'serif' },
  { name: 'Frank Ruhl Libre', cat: 'serif' }, { name: 'Sorts Mill Goudy', cat: 'serif' },
  // — Sans —
  { name: 'Inter', cat: 'sans' }, { name: 'Roboto', cat: 'sans' },
  { name: 'Open Sans', cat: 'sans' }, { name: 'Lato', cat: 'sans' },
  { name: 'Montserrat', cat: 'sans' }, { name: 'Poppins', cat: 'sans' },
  { name: 'Work Sans', cat: 'sans' }, { name: 'DM Sans', cat: 'sans' },
  { name: 'Manrope', cat: 'sans' }, { name: 'Nunito', cat: 'sans' },
  { name: 'Nunito Sans', cat: 'sans' }, { name: 'Mulish', cat: 'sans' },
  { name: 'Rubik', cat: 'sans' }, { name: 'Karla', cat: 'sans' },
  { name: 'Source Sans 3', cat: 'sans' }, { name: 'Figtree', cat: 'sans' },
  { name: 'Plus Jakarta Sans', cat: 'sans' }, { name: 'Be Vietnam Pro', cat: 'sans' },
  { name: 'Sora', cat: 'sans' }, { name: 'Outfit', cat: 'sans' },
  { name: 'Epilogue', cat: 'sans' }, { name: 'Albert Sans', cat: 'sans' },
  { name: 'Onest', cat: 'sans' }, { name: 'Public Sans', cat: 'sans' },
  { name: 'IBM Plex Sans', cat: 'sans' }, { name: 'Red Hat Display', cat: 'sans' },
  { name: 'Libre Franklin', cat: 'sans' }, { name: 'Archivo', cat: 'sans' },
  { name: 'Hanken Grotesk', cat: 'sans' }, { name: 'Space Grotesk', cat: 'sans' },
  { name: 'Familjen Grotesk', cat: 'sans' }, { name: 'Instrument Sans', cat: 'sans' },
  { name: 'Lexend', cat: 'sans' }, { name: 'Urbanist', cat: 'sans' },
  { name: 'Jost', cat: 'sans' }, { name: 'Cabin', cat: 'sans' },
  { name: 'Assistant', cat: 'sans' }, { name: 'Barlow', cat: 'sans' },
  { name: 'Heebo', cat: 'sans' }, { name: 'Quicksand', cat: 'sans' },
  { name: 'Josefin Sans', cat: 'sans' }, { name: 'Bricolage Grotesque', cat: 'sans' },
  { name: 'Syne', cat: 'sans' }, { name: 'Unbounded', cat: 'sans' },
  { name: 'Schibsted Grotesk', cat: 'sans' }, { name: 'Oxygen', cat: 'sans' },
  // — Display —
  { name: 'Bebas Neue', cat: 'display' }, { name: 'Anton', cat: 'display' },
  { name: 'Oswald', cat: 'display' }, { name: 'Archivo Black', cat: 'display' },
  { name: 'Abril Fatface', cat: 'display' }, { name: 'Righteous', cat: 'display' },
  { name: 'Lobster', cat: 'display' }, { name: 'Comfortaa', cat: 'display' },
  { name: 'Fredoka', cat: 'display' }, { name: 'Bungee', cat: 'display' },
  { name: 'Staatliches', cat: 'display' }, { name: 'Teko', cat: 'display' },
  { name: 'Passion One', cat: 'display' }, { name: 'Alfa Slab One', cat: 'display' },
  { name: 'Titan One', cat: 'display' }, { name: 'Rozha One', cat: 'display' },
  { name: 'Chivo', cat: 'display' }, { name: 'Bowlby One', cat: 'display' },
  // — Mono —
  { name: 'JetBrains Mono', cat: 'mono' }, { name: 'Fira Code', cat: 'mono' },
  { name: 'Space Mono', cat: 'mono' }, { name: 'IBM Plex Mono', cat: 'mono' },
  { name: 'Roboto Mono', cat: 'mono' }, { name: 'Source Code Pro', cat: 'mono' },
  { name: 'Inconsolata', cat: 'mono' }, { name: 'DM Mono', cat: 'mono' },
  { name: 'Overpass Mono', cat: 'mono' }, { name: 'Martian Mono', cat: 'mono' },
  // — Script / Handwriting —
  { name: 'Caveat', cat: 'script' }, { name: 'Dancing Script', cat: 'script' },
  { name: 'Pacifico', cat: 'script' }, { name: 'Satisfy', cat: 'script' },
  { name: 'Sacramento', cat: 'script' }, { name: 'Great Vibes', cat: 'script' },
  { name: 'Kalam', cat: 'script' }, { name: 'Shadows Into Light', cat: 'script' },
  { name: 'Permanent Marker', cat: 'script' }, { name: 'Cookie', cat: 'script' },
  { name: 'Allura', cat: 'script' }, { name: 'Parisienne', cat: 'script' },
]

export const FONT_CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'serif', label: 'Serif' },
  { key: 'sans', label: 'Sans' },
  { key: 'display', label: 'Display' },
  { key: 'mono', label: 'Mono' },
  { key: 'script', label: 'Script' },
]

// Back-compat: plain name list.
export const GOOGLE_FONTS = FONTS.map((f) => f.name)

const loaded = new Set()
export function loadFont(name) {
  if (!name || loaded.has(name)) return
  loaded.add(name)
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, '+')}:wght@400;500;600;700&display=swap`
  document.head.appendChild(link)
}
