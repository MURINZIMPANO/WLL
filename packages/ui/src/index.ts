/**
 * `@lyriclens/ui` — the shared design system.
 *
 * Every screen in the web app, the desktop overlay and the marketing site is
 * built from these components and the tokens in `styles/globals.css`. There
 * are no one-off styles anywhere in the product; if a screen needs something
 * new, it is added here first.
 */

export { Button, buttonVariants, type ButtonProps } from './components/Button';
export { Chip, chipVariants, type ChipProps } from './components/Chip';
export { Card, type CardProps } from './components/Card';
export { Badge, badgeVariants, type BadgeProps } from './components/Badge';
export { Input, type InputProps } from './components/Input';
export { Skeleton, MediaCardSkeleton } from './components/Skeleton';
export { ProgressRing, type ProgressRingProps } from './components/ProgressRing';
export { MediaCard, MediaRail, type MediaCardProps } from './components/MediaCard';
export { PlayerControls, type PlayerControlsProps } from './components/PlayerControls';
export {
  ToastProvider,
  useToast,
  type ToastOptions,
  type ToastTone,
  type ToastContextValue,
} from './components/Toast';
export { Sheet, type SheetProps } from './components/Sheet';
export {
  MobileTabBar,
  SidebarNav,
  DEFAULT_NAV_ITEMS,
  type NavItem,
  type NavUser,
} from './components/AppNav';
export { cn } from './lib/cn';
export {
  EASE_OUT,
  SPRING,
  DURATIONS,
  fadeIn,
  riseIn,
  staggerParent,
  staggerChild,
  reducedVariants,
} from './lib/motion';
