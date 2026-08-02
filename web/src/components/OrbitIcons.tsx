import type { ReactNode, SVGProps } from "react";

export type OrbitIconSize = "sm" | "md" | "nav";

const ICON_PX: Record<OrbitIconSize, number> = {
  sm: 16,
  md: 20,
  nav: 20,
};

type OrbitIconProps = SVGProps<SVGSVGElement> & {
  size?: OrbitIconSize;
};

function OrbitIcon({ size = "sm", className, children, ...props }: OrbitIconProps & { children: ReactNode }) {
  const px = ICON_PX[size];
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
      {...props}
    >
      {children}
    </svg>
  );
}

export function DiaryIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M12 7v14" />
      <path d="M5.5 5.5A2 2 0 0 1 7 5h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 1.5-1.94" />
      <path d="M9 5V3.5A1.5 1.5 0 0 1 10.5 2h3A1.5 1.5 0 0 1 15 3.5V5" />
    </OrbitIcon>
  );
}

export function TimelineIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <ellipse cx="12" cy="12" rx="8" ry="3.25" transform="rotate(-18 12 12)" />
      <circle cx="17.5" cy="9.5" r="1.25" fill="currentColor" stroke="none" />
      <path d="M6.5 14.5l1.25 1.25M9 17l.75.75" />
    </OrbitIcon>
  );
}

export function MessageIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </OrbitIcon>
  );
}

export function LetterIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </OrbitIcon>
  );
}

export function MemoIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M12 17v5" />
      <path d="M9 22h6" />
      <path d="M8.5 3.5A5.5 5.5 0 0 1 18 9c0 3.5-2.5 5.5-5 7.5S8 18.5 8 15a5.5 5.5 0 0 1-.5-11.5z" />
    </OrbitIcon>
  );
}

export function GalleryIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </OrbitIcon>
  );
}

export function MemoriesIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M12 3.5 13.6 8.2 18.5 9l-3.6 3.4.9 4.8L12 15.2 8.2 17.2l.9-4.8L5.5 9l4.9-.8L12 3.5z" />
      <path d="M18.5 4.5v2" />
      <path d="M17.5 5.5h2" />
      <path d="M5 16.5v1.5" />
      <path d="M4.25 17.25h1.5" />
    </OrbitIcon>
  );
}

export function HomeIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
    </OrbitIcon>
  );
}

export function NoteIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </OrbitIcon>
  );
}

export function AppreciationIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </OrbitIcon>
  );
}

export type NavContentType = "diary" | "note" | "appreciation" | "timeline" | "message" | "letter" | "memo";

export const NAV_CONTENT_ICONS = {
  diary: DiaryIcon,
  note: NoteIcon,
  appreciation: AppreciationIcon,
  timeline: TimelineIcon,
  message: MessageIcon,
  letter: LetterIcon,
  memo: MemoIcon,
} as const satisfies Record<NavContentType, (props: OrbitIconProps) => React.ReactElement>;

export function SettingsIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </OrbitIcon>
  );
}

export function KeyIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <circle cx="8" cy="15" r="4" />
      <path d="m11.5 11.5 8.5-8.5" />
      <path d="M17 3l4 4" />
      <path d="M14 6l2 2" />
    </OrbitIcon>
  );
}

export function AiIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M12 3l1.2 3.6L17 8l-3.8 1.4L12 13l-1.2-3.6L7 8l3.8-1.4L12 3z" />
      <path d="M5 16l.8 2.4L8 19l-2.2.8L5 22l-.8-2.2L2 19l2.2-.6L5 16z" />
      <path d="M19 14l.6 1.8L21 17l-1.4.5L19 19l-.6-1.5L17 17l1.4-.5L19 14z" />
    </OrbitIcon>
  );
}

/** Thinking / reasoning affordance (DeepSeek-style header). */
export function ThinkingIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
      <path d="M12 18v3" />
      <path d="M9.5 21h5" />
    </OrbitIcon>
  );
}

export function UserIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </OrbitIcon>
  );
}

export function PaletteIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="6.5" cy="12.5" r="0.5" fill="currentColor" stroke="none" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
    </OrbitIcon>
  );
}

export function LogoutIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </OrbitIcon>
  );
}

export function SearchIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" />
    </OrbitIcon>
  );
}

export function BellIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M12 4a4 4 0 0 0-4 4v2.5c0 .8-.3 1.6-.8 2.2L5.5 15.5A1 1 0 0 0 6.4 17h11.2a1 1 0 0 0 .9-1.5l-1.7-2.8a3.5 3.5 0 0 1-.8-2.2V8a4 4 0 0 0-4-4" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </OrbitIcon>
  );
}

export function SunIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </OrbitIcon>
  );
}

export function MoonIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </OrbitIcon>
  );
}

export function MonitorIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </OrbitIcon>
  );
}

export function MenuIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </OrbitIcon>
  );
}

export function CloseIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </OrbitIcon>
  );
}

export function TrashIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </OrbitIcon>
  );
}

export function ShareIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <circle cx="6" cy="12" r="2.25" />
      <circle cx="18" cy="6" r="2.25" />
      <circle cx="18" cy="18" r="2.25" />
      <path d="M8.1 10.8l7.8-3.6M8.1 13.2l7.8 3.6" />
    </OrbitIcon>
  );
}

export function SidebarExpandIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="m13 5 7 7-7 7M6 5l7 7-7 7" />
    </OrbitIcon>
  );
}

export function SidebarCollapseIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="m11 19-7-7 7-7M18 19l-7-7 7-7" />
    </OrbitIcon>
  );
}

export function ArrowLeftIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </OrbitIcon>
  );
}

export function ArrowUpIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </OrbitIcon>
  );
}

export function TocIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M4 6h16M4 12h10M4 18h16" />
    </OrbitIcon>
  );
}

export function MarginaliaIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
    </OrbitIcon>
  );
}

export function CalendarIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </OrbitIcon>
  );
}

export function ChevronLeftIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M15 18l-6-6 6-6" />
    </OrbitIcon>
  );
}

export function ChevronRightIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M9 18l6-6-6-6" />
    </OrbitIcon>
  );
}

export function ChevronsLeftIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
    </OrbitIcon>
  );
}

export function ChevronsRightIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M13 17l5-5-5-5M6 17l5-5-5-5" />
    </OrbitIcon>
  );
}

export function ChevronDownIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M6 9l6 6 6-6" />
    </OrbitIcon>
  );
}

export function PlusIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </OrbitIcon>
  );
}

export function PanelSidebarIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M14 5v14" />
    </OrbitIcon>
  );
}

export function PanelFloatingIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <rect x="7" y="13" width="5" height="4" rx="1" fill="currentColor" stroke="none" />
    </OrbitIcon>
  );
}

export function PanelFullscreenIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
    </OrbitIcon>
  );
}

export function CheckIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M20 6 9 17l-5-5" />
    </OrbitIcon>
  );
}

export function AlertIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4M12 16h.01" />
    </OrbitIcon>
  );
}

export function BoldIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M6 4h6.5a3.5 3.5 0 0 1 0 7H6V4z" />
      <path d="M6 11h7a3.5 3.5 0 0 1 0 7H6v-7z" />
    </OrbitIcon>
  );
}

export function ItalicIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M19 4h-9M14 20H5M15 4 9 20" />
    </OrbitIcon>
  );
}

export function StrikeIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M16 4H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H8" />
      <path d="M4 12h16" />
    </OrbitIcon>
  );
}

export function Heading2Icon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M4 12V4h2.5v3H10V4h2.5v8H10V9H6.5v3H4z" />
      <path d="M17 14h-4v2h4v2h-6V8h6v2h-4v2h4v2z" />
    </OrbitIcon>
  );
}

export function Heading3Icon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M4 12V4h2.5v3H10V4h2.5v8H10V9H6.5v3H4z" />
      <path d="M17 10h-4v6h4a2 2 0 0 0 0-4h-4" />
    </OrbitIcon>
  );
}

export function ListIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="5" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="18" r="1" fill="currentColor" stroke="none" />
    </OrbitIcon>
  );
}

export function QuoteIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M3 10c0-2.2 1.5-4 3.5-4.5C7 7.5 6 9 6 10.5 6 12 7 13 8.5 13H9v3H5c-1.1 0-2-.9-2-2v-4z" />
      <path d="M13 10c0-2.2 1.5-4 3.5-4.5C17 7.5 16 9 16 10.5 16 12 17 13 18.5 13H19v3h-4c-1.1 0-2-.9-2-2v-4z" />
    </OrbitIcon>
  );
}

export function ImageIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="m21 16-5.5-5.5L5 19" />
    </OrbitIcon>
  );
}

export function UndoIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M9 7H4v5" />
      <path d="M4 12a8 8 0 1 0 2.3 5.7" />
    </OrbitIcon>
  );
}

export function RedoIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M15 7h5v5" />
      <path d="M20 12a8 8 0 1 1-2.3 5.7" />
    </OrbitIcon>
  );
}

export function ActivityIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <path d="M7 14h2" />
      <path d="M11 14h2" />
      <path d="M15 14h2" />
      <path d="M7 18h2" />
      <path d="M11 18h6" />
    </OrbitIcon>
  );
}

export function EyeIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </OrbitIcon>
  );
}

export function EyeOffIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </OrbitIcon>
  );
}

export function DraftBoxIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </OrbitIcon>
  );
}

export function InboxIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </OrbitIcon>
  );
}

export function StopIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
    </OrbitIcon>
  );
}

export function ReloadIcon(props: OrbitIconProps) {
  return (
    <OrbitIcon {...props}>
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </OrbitIcon>
  );
}


