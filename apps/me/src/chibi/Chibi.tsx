export type PoseId = "sitting" | "standing" | "pointing";

type ChibiProps = {
  pose: PoseId;
  className?: string;
  alt?: string;
};

const SPRITES: Record<PoseId, string> = {
  sitting: "/chibi/sitting.png",
  standing: "/chibi/standing.png",
  pointing: "/chibi/pointing.png"
};

/** Full-pose sprite. Bones/parts rig is unused — these PNGs are the source of truth. */
export function Chibi({ pose, className = "", alt = "" }: ChibiProps) {
  return (
    <img
      src={SPRITES[pose]}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      draggable={false}
      className={["block h-auto w-full select-none", className]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
