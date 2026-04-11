import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

export const PageLoader = forwardRef<HTMLDivElement>((_props, ref) => {
  return (
    <div ref={ref} className="flex items-center justify-center h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
});

PageLoader.displayName = "PageLoader";
