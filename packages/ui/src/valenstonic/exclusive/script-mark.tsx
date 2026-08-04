import * as React from "react";
import { cn } from "../../lib/utils";

export interface ScriptMarkProps extends React.HTMLAttributes<HTMLParagraphElement> {}

/** Valenstonic-only script brand line (Great Vibes). */
const ScriptMark = React.forwardRef<HTMLParagraphElement, ScriptMarkProps>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("font-script text-4xl text-primary", className)}
      {...props}
    />
  )
);
ScriptMark.displayName = "ScriptMark";

export { ScriptMark };
