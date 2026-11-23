const paths = {
  workout: 'M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12',
  progress: 'M4 5v14h16M8 15l4-5 3 3 5-7',
  history: 'M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zM12 7.5V12l3 2',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  close: 'M6 6l12 12M18 6L6 18',
  search: 'M11 4.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM16 16l4 4',
  user: 'M12 4.4a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2zM5 20c1-4 4-5.5 7-5.5s6 1.5 7 5.5',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  chevronRight: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  chevronLeft: 'M15 6l-6 6 6 6',
  trash: 'M5 7h14M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3',
  star: 'M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4.1-4 5.7-.8z',
  balance: 'M12 4v16M5 8h14M8 20h8M5 8l-2.5 6a2.7 2.7 0 005 0L5 8zM19 8l-2.5 6a2.7 2.7 0 005 0L19 8z',
  repeat: 'M17 2l3 3-3 3M4 11V9a4 4 0 014-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 01-4 4H4',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M18 13l-6 6-6-6',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  upload: 'M12 16V5M7 10l5-5 5 5M5 20h14',
  logout: 'M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 16l-4-4 4-4M6 12h10',
  cloud: 'M7 18h10a4 4 0 00.6-7.95A6 6 0 006.2 9.5 4.3 4.3 0 007 18z',
  timer: 'M12 7.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM12 11v3l2 1.5M9.5 3h5M12 3v2',
  info: 'M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zM12 11v5M12 8h.01',
  target: 'M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zM12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM12 11.5v1',
  scale: 'M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1zM9 9a3 3 0 016 0l-2 2',
  calendar: 'M5 6h14v14H5zM5 10h14M9 3v4M15 3v4',
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 22, stroke = 2, label }: { name: IconName; size?: number; stroke?: number; label?: string }) {
  const filled = name === 'more';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={filled ? 3.4 : stroke}
      strokeLinecap="round" strokeLinejoin="round" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d={paths[name]} />
    </svg>
  );
}
