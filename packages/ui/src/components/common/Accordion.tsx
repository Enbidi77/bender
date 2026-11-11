import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from './Button.js';

export interface AccordionProps {
  title: string;
  icon?: React.ReactNode;
  defaultExpanded?: boolean;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const Accordion: React.FC<AccordionProps> = ({
  title,
  icon,
  defaultExpanded = true,
  headerAction,
  children,
  className = '',
}) => {
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded);

  return (
    <div className={cn('border-b border-[#181818]', className)}>
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between px-2.5 py-1.5 bg-[#232323] hover:bg-[#2c2c2c] cursor-pointer select-none transition-colors"
      >
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-300">
          <ChevronRight
            size={13}
            className={cn('text-gray-400 transition-transform duration-150', {
              'rotate-90': expanded,
            })}
          />
          {icon && <span className="text-gray-400">{icon}</span>}
          <span>{title}</span>
        </div>
        {headerAction && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center"
          >
            {headerAction}
          </div>
        )}
      </div>
      {expanded && <div className="p-2.5 space-y-2 bg-[#282828]">{children}</div>}
    </div>
  );
};
