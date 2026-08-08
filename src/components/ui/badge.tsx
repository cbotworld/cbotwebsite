import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'carrom' | 'warning';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const base =
    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2';

  const variants = {
    default: 'border-transparent bg-primary text-primary-foreground shadow',
    secondary: 'border-transparent bg-secondary text-secondary-foreground',
    destructive: 'border-transparent bg-destructive text-destructive-foreground shadow',
    outline: 'text-foreground border-border',
    success: 'border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    warning: 'border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    carrom:
      'border-amber-500/30 bg-gradient-to-r from-amber-500/20 to-amber-600/20 text-amber-600 dark:text-amber-300 font-bold',
  };

  return <div className={cn(base, variants[variant], className)} {...props} />;
}

export { Badge };
