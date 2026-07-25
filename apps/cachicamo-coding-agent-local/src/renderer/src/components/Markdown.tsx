import { useLayoutEffect, useRef } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import twemoji from "@twemoji/api";
import { cn } from "@/lib/utils";

const components: Components = {
  h1: ({ className, ...props }) => (
    <h1 className={cn("mb-2 mt-3 text-[18px] font-semibold text-foreground first:mt-0", className)} {...props} />
  ),
  h2: ({ className, ...props }) => (
    <h2 className={cn("mb-2 mt-3 text-[16px] font-semibold text-foreground first:mt-0", className)} {...props} />
  ),
  h3: ({ className, ...props }) => (
    <h3 className={cn("mb-1.5 mt-2.5 text-[14px] font-semibold text-foreground first:mt-0", className)} {...props} />
  ),
  p: ({ className, ...props }) => (
    <p className={cn("mb-2 last:mb-0 whitespace-pre-wrap", className)} {...props} />
  ),
  ul: ({ className, ...props }) => (
    <ul className={cn("mb-2 list-disc space-y-1 pl-5 last:mb-0", className)} {...props} />
  ),
  ol: ({ className, ...props }) => (
    <ol className={cn("mb-2 list-decimal space-y-1 pl-5 last:mb-0", className)} {...props} />
  ),
  li: ({ className, ...props }) => <li className={cn("leading-6", className)} {...props} />,
  a: ({ className, ...props }) => (
    <a
      className={cn("text-primary underline underline-offset-2 hover:opacity-90", className)}
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn("mb-2 border-l-2 border-primary/50 pl-3 text-muted-foreground last:mb-0", className)}
      {...props}
    />
  ),
  hr: ({ className, ...props }) => <hr className={cn("my-3 border-border", className)} {...props} />,
  table: ({ className, ...props }) => (
    <div className="mb-2 overflow-x-auto last:mb-0">
      <table className={cn("w-full border-collapse text-[12px]", className)} {...props} />
    </div>
  ),
  th: ({ className, ...props }) => (
    <th
      className={cn("border border-border bg-muted px-2 py-1 text-left font-medium", className)}
      {...props}
    />
  ),
  td: ({ className, ...props }) => (
    <td className={cn("border border-border px-2 py-1 align-top", className)} {...props} />
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = Boolean(className?.includes("language-") || String(children).includes("\n"));
    if (isBlock) {
      return (
        <code className={cn("font-mono text-[12px] text-foreground", className)} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className={cn(
          "rounded-[3px] bg-muted px-1 py-0.5 font-mono text-[12px] text-foreground",
          className
        )}
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ className, ...props }) => (
    <pre
      className={cn(
        "mb-2 overflow-x-auto rounded-[4px] border border-border bg-[#0f0f0f] p-2.5 font-mono text-[12px] leading-5 last:mb-0",
        className
      )}
      {...props}
    />
  ),
  strong: ({ className, ...props }) => (
    <strong className={cn("font-semibold text-foreground", className)} {...props} />
  )
};

type MarkdownProps = {
  content: string;
  className?: string;
};

export function Markdown({ content, className }: MarkdownProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    // WSL/Linux often has no color emoji font; Twemoji renders as images instead.
    twemoji.parse(root, {
      folder: "svg",
      ext: ".svg",
      className: "twemoji"
    });
  }, [content]);

  return (
    <div ref={rootRef} className={cn("markdown-body min-w-0", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
