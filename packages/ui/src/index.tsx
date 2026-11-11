import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-medium rounded text-xs transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none',
          {
            'bg-blue-600 hover:bg-blue-500 text-white': variant === 'primary',
            'bg-[#303030] hover:bg-[#3d3d3d] text-gray-200 border border-[#3e3e3e]':
              variant === 'secondary',
            'bg-transparent hover:bg-[#303030] text-gray-300': variant === 'ghost',
            'bg-red-600 hover:bg-red-500 text-white': variant === 'danger',
            'px-2 py-1 h-6': size === 'sm',
            'px-3 py-1.5 h-7': size === 'md',
            'px-4 py-2 h-9': size === 'lg',
            'p-1.5 h-7 w-7': size === 'icon',
          },
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export interface PanelHeaderProps {
  title: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({ title, icon, actions, className }) => {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-3 py-1.5 bg-[#282828] border-b border-[#181818] select-none text-xs text-gray-300 font-semibold',
        className,
      )}
    >
      <div className="flex items-center gap-1.5">
        {icon}
        <span>{title}</span>
      </div>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </div>
  );
};
