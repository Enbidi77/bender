import React from 'react';
import { cn } from './Button.js';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1 w-full">
        {label && <label className="text-[11px] text-gray-400">{label}</label>}
        <div className="relative flex items-center">
          <select
            ref={ref}
            className={cn(
              'w-full bg-[#1d1e22] text-gray-200 border border-[#3e3e3e] rounded px-2 py-1 pr-6 text-xs appearance-none focus:outline-none focus:border-[#4772b3] cursor-pointer transition-colors',
              className,
            )}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#282828] text-gray-200">
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2 text-gray-400 pointer-events-none" />
        </div>
      </div>
    );
  },
);
Select.displayName = 'Select';
