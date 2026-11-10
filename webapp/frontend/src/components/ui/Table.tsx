import React from "react";
import { cn } from "../../lib/utils";

export const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div className="w-full overflow-x-auto border border-neutral-300 rounded bg-white">
      <table
        className={cn("w-full border-collapse text-left text-xs", className)}
        {...props}
      >
        {children}
      </table>
    </div>
  );
};
