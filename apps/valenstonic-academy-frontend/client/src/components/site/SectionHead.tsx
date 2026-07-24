export function SectionHead(props: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mx-auto mb-7 max-w-xl text-center">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {props.eyebrow}
      </p>
      <h2 className="mt-1.5 font-sans text-[clamp(1.45rem,2.6vw,1.9rem)] font-bold tracking-tight text-foreground">
        {props.title}
      </h2>
      {props.description ? (
        <p className="mt-2 text-sm text-muted-foreground">{props.description}</p>
      ) : null}
    </div>
  );
}
