type IconProps = { className?: string }

const base = {
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="2" y="3.5" width="12" height="10.5" rx="1.6" />
      <path d="M2 6.6h12M5.5 2v3M10.5 2v3" />
    </svg>
  )
}

export function CheckSquareIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="2.5" y="2.5" width="11" height="11" rx="2.2" />
      <path d="M5.6 8.1l1.7 1.7 3.2-3.5" />
    </svg>
  )
}

export function FolderIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M2 5.3c0-.8.6-1.5 1.4-1.5h2.3l1.3 1.6h5.6c.8 0 1.4.7 1.4 1.5v4.8c0 .8-.6 1.4-1.4 1.4H3.4c-.8 0-1.4-.6-1.4-1.4z" />
    </svg>
  )
}

export function ChartIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M2.5 13.2h11" />
      <rect x="3.4" y="8" width="2.4" height="4" rx=".6" />
      <rect x="6.9" y="5" width="2.4" height="7" rx=".6" />
      <rect x="10.4" y="9.4" width="2.4" height="2.6" rx=".6" />
    </svg>
  )
}

export function ChevronLeftIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M9.8 3.5L5.6 8l4.2 4.5" />
    </svg>
  )
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M6.2 3.5L10.4 8l-4.2 4.5" />
    </svg>
  )
}

export function PencilIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M10.6 2.9a1.5 1.5 0 012.1 2.1l-6.4 6.4-2.8.7.7-2.8z" />
    </svg>
  )
}

export function TrashIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M3 4.5h10M6.4 4.5V3.2h3.2v1.3M4.5 4.5l.6 8.1c0 .5.4.9.9.9h3.9c.5 0 .9-.4.9-.9l.6-8.1" />
    </svg>
  )
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...base} strokeWidth={2} className={className} aria-hidden="true">
      <path d="M3.2 8.4l3 3 6.6-6.8" />
    </svg>
  )
}

export function FileIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M4.2 2.4h4.6l3 3v7.6a.9.9 0 01-.9.9H4.2a.9.9 0 01-.9-.9V3.3a.9.9 0 01.9-.9z" />
      <path d="M8.7 2.6v3.1h3" />
    </svg>
  )
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="7.2" cy="7.2" r="4.2" />
      <path d="M10.4 10.4l3.1 3.1" />
    </svg>
  )
}

export function MoonIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M13 9.6A5.4 5.4 0 016.4 3a5.6 5.6 0 106.6 6.6z" />
    </svg>
  )
}

export function SunIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M12.4 3.6l-1.1 1.1M4.7 11.3l-1.1 1.1" />
    </svg>
  )
}

export function TimerIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="8" cy="8.5" r="5.2" />
      <path d="M8 5.8v3l2.1 1.2" />
    </svg>
  )
}

export function GearIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="8" cy="8" r="2.1" />
      <path d="M8 1.6l.6 1.7c.6.1 1.2.4 1.7.7l1.6-.8 1.1 1.1-.8 1.6c.3.5.6 1.1.7 1.7l1.7.6v1.6l-1.7.6c-.1.6-.4 1.2-.7 1.7l.8 1.6-1.1 1.1-1.6-.8c-.5.3-1.1.6-1.7.7l-.6 1.7H8l-.6-1.7a4.8 4.8 0 01-1.7-.7l-1.6.8-1.1-1.1.8-1.6a4.8 4.8 0 01-.7-1.7L1.4 9.6V8l1.7-.6c.1-.6.4-1.2.7-1.7l-.8-1.6 1.1-1.1 1.6.8c.5-.3 1.1-.6 1.7-.7L8 1.6z" />
    </svg>
  )
}
