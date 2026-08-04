import { Link } from "react-router-dom";

type NotFoundPageProps = {
  message?: string;
};

export function NotFoundPage({
  message = "This share is gone or expired."
}: NotFoundPageProps) {
  return (
    <>
      <h1 className="mb-1 text-3xl font-semibold tracking-tight">Gone</h1>
      <p className="mb-4 text-sm text-muted-foreground">{message}</p>
      <p className="text-sm text-muted-foreground">
        <Link to="/" className="underline underline-offset-3">
          Create a new share
        </Link>
      </p>
    </>
  );
}
