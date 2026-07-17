import { AlertTriangle } from "lucide-react";

export function InsufficientDataState({
  title = "Insufficient governed data",
  message,
}: {
  title?: string;
  message: string;
}) {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-40" />
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs mt-1">{message}</p>
    </div>
  );
}
