import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type InlineAlertVariant = "error" | "success";

const variantClasses: Record<InlineAlertVariant, string> = {
  error: "border-destructive/30 bg-destructive/10 text-destructive",
  success: "border-success/30 bg-success/10 text-success",
};

const variantIcon: Record<InlineAlertVariant, typeof AlertCircle> = {
  error: AlertCircle,
  success: CheckCircle2,
};

export function InlineAlert({
  variant = "error",
  children,
  className,
}: {
  variant?: InlineAlertVariant;
  children: React.ReactNode;
  className?: string;
}) {
  const Icon = variantIcon[variant];
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border p-3 text-sm",
        variantClasses[variant],
        className
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">{children}</div>
    </div>
  );
}
