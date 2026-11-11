import React, { useState, useEffect } from 'react';
import { cn } from './Button.js';

export interface NumberInputProps {
  label?: string;
  labelColor?: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  precision?: number;
  unit?: string;
  className?: string;
  disabled?: boolean;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  label,
  labelColor,
  value,
  onChange,
  step = 0.1,
  min,
  max,
  precision = 2,
  unit = '',
  className = '',
  disabled = false,
}) => {
  const [tempValue, setTempValue] = useState<string>(value.toFixed(precision));
  const [isEditing, setIsEditing] = useState<boolean>(false);

  useEffect(() => {
    if (!isEditing) {
      setTempValue(value.toFixed(precision));
    }
  }, [value, precision, isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    let parsed = parseFloat(tempValue);
    if (isNaN(parsed)) {
      parsed = value;
    }
    if (min !== undefined && parsed < min) parsed = min;
    if (max !== undefined && parsed > max) parsed = max;
    onChange(parsed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.round((value + step) * 1000) / 1000;
      if (max === undefined || next <= max) onChange(next);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.round((value - step) * 1000) / 1000;
      if (min === undefined || next >= min) onChange(next);
    }
  };

  return (
    <div
      className={cn(
        'flex items-center bg-[#1d1e22] border border-[#3e3e3e] rounded px-1.5 py-0.5 text-xs focus-within:border-[#4772b3] group transition-colors',
        disabled ? 'opacity-50 pointer-events-none' : '',
        className,
      )}
    >
      {label && (
        <span
          className={cn(
            'text-[10px] font-bold uppercase select-none mr-1.5',
            labelColor ? labelColor : 'text-gray-400',
          )}
        >
          {label}
        </span>
      )}
      <input
        type="text"
        disabled={disabled}
        value={isEditing ? tempValue : `${value.toFixed(precision)}${unit ? ' ' + unit : ''}`}
        onFocus={() => {
          setIsEditing(true);
          setTempValue(value.toFixed(precision));
        }}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full bg-transparent text-gray-200 text-right focus:outline-none font-mono text-[11px]"
      />
    </div>
  );
};

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  ({ label, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && <label className="text-[11px] text-gray-400">{label}</label>}
        <input
          ref={ref}
          className={cn(
            'bg-[#1d1e22] border border-[#3e3e3e] rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-[#4772b3] transition-colors',
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);
TextInput.displayName = 'TextInput';
