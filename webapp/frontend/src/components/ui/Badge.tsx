import React from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info";
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = "default",
  children,
  ...props
}) => {
  const variants = {
    default: "bg-neutral-100 text-neutral-600 border-neutral-300",
    success: "bg-success-50 text-success-700 border-success-200",
    warning: "bg-tertiary-50 text-tertiary-600 border-tertiary-200",
    danger: "bg-danger-50 text-danger-700 border-danger-200",
    info: "bg-info-50 text-info-700 border-info-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
};
