import React from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, type = "text", disabled, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-xs font-semibold text-neutral-600 mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          type={type}
          disabled={disabled}
          className={cn(
            "w-full h-7 px-2 text-xs border rounded bg-white text-neutral-900 border-neutral-400 focus:outline-none focus:border-primary-700 focus:ring-1 focus:ring-primary-700 disabled:bg-neutral-100 disabled:text-neutral-500",
            error &&
              "border-danger-600 focus:border-danger-600 focus:ring-danger-600",
            className,
          )}
          {...props}
        />
        {error && <p className="mt-0.5 text-[10px] text-danger-600">{error}</p>}
      </div>
    );
  },
);

Input.displayName = "Input";
