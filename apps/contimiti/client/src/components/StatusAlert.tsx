import { Alert, AlertDescription, AlertTitle } from "@chiwire/ui/internal";
import type { StatusKind } from "../lib/api";

type StatusAlertProps = {
  message: string;
  kind?: StatusKind;
  title?: string;
};

export function StatusAlert({ message, kind = null, title }: StatusAlertProps) {
  if (!message) {
    return null;
  }

  const variant =
    kind === "ok" ? "success" : kind === "err" ? "destructive" : "default";

  return (
    <Alert variant={variant} className="mt-4">
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
