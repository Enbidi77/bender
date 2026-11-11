import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'active';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon';
  active?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'md', active = false, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-medium rounded transition-colors select-none focus:outline-none focus:ring-1 focus:ring-[#4772b3] disabled:opacity-40 disabled:pointer-events-none cursor-pointer',
          {
            'bg-[#4772b3] hover:bg-[#5885c7] text-white': variant === 'primary' || active,
            'bg-[#303030] hover:bg-[#3e3e3e] text-gray-200 border border-[#3e3e3e]':
              variant === 'secondary' && !active,
            'bg-transparent hover:bg-[#383838] text-gray-300 hover:text-white':
              variant === 'ghost' && !active,
            'bg-red-600 hover:bg-red-500 text-white': variant === 'danger',
            'px-1.5 py-0.5 text-[11px] h-5': size === 'xs',
            'px-2 py-1 text-xs h-6': size === 'sm',
            'px-3 py-1.5 text-xs h-7': size === 'md',
            'px-4 py-2 text-sm h-8': size === 'lg',
            'p-1 h-6 w-6 text-xs': size === 'icon',
          },
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
