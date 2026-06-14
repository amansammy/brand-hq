// Lightweight inline icon set (stroke-based, lucide-style) — no dependency.
const P = {
  feed: <><path d="M4 6h16M4 12h16M4 18h10" /></>,
  tasks: <><rect x="3" y="3" width="7" height="18" rx="1.5" /><rect x="14" y="3" width="7" height="11" rx="1.5" /></>,
  files: <><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 3h9l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /></>,
  notes: <><path d="M4 4h16v16H4z" /><path d="M8 9h8M8 13h8M8 17h5" /></>,
  mood: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  close: <><path d="M18 6 6 18M6 6l12 12" /></>,
  send: <><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" /></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>,
  download: <><path d="M12 4v12M7 11l5 5 5-5" /><path d="M4 18v2h16v-2" /></>,
  pin: <><path d="m9 4 6 0 1 6 3 3H5l3-3 1-6Z" /><path d="M12 13v7" /></>,
  star: <><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19l1-5.8L3.5 9.2l5.9-.9L12 3Z" /></>,
  heart: <><path d="M12 20s-7-4.4-9.3-8.2C1 8.6 2.5 5 6 5c2 0 3.2 1.2 4 2.3C10.8 6.2 12 5 14 5c3.5 0 5 3.6 3.3 6.8C19 15.6 12 20 12 20Z" /></>,
  comment: <><path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12Z" /></>,
  calendar: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></>,
  trash: <><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" /></>,
  check: <><path d="M20 6 9 17l-5-5" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></>,
  flag: <><path d="M4 21V4M4 4h13l-2 4 2 4H4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  drops: <><path d="M3 7l9-4 9 4-9 4-9-4Z" /><path d="M3 12l9 4 9-4" /><path d="M3 17l9 4 9-4" /></>,
  brand: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z" /><path d="M19 19H6a2 2 0 0 0-2 2" /></>,
  trophy: <><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></>,
  more: <><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></>,
  tag: <><path d="M3 7v5l9 9 7-7-9-9H3Z" /><circle cx="7.5" cy="7.5" r="1.3" /></>,
  grip: <><circle cx="9" cy="6" r="1.2" /><circle cx="9" cy="12" r="1.2" /><circle cx="9" cy="18" r="1.2" /><circle cx="15" cy="6" r="1.2" /><circle cx="15" cy="12" r="1.2" /><circle cx="15" cy="18" r="1.2" /></>,
  chevronDown: <><path d="m6 9 6 6 6-6" /></>,
  filter: <><path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z" /></>,
  layout: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></>,
}

export function Icon({ name, size = 20, className = '', strokeWidth = 1.8, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round"
      strokeLinejoin="round" className={className} aria-hidden="true" {...rest}>
      {P[name] || null}
    </svg>
  )
}
