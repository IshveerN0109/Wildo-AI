import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

// GFM tables render at their natural width, which can exceed a phone
// screen — wrapping in its own horizontally-scrollable box keeps the
// table intact (and the rest of the page layout unbroken) instead of
// overflowing or forcing the whole page to scroll sideways.
const components: Components = {
  table: ({ children, ...props }) => (
    <div className="my-4 overflow-x-auto rounded-lg border">
      <table {...props} className="my-0">
        {children}
      </table>
    </div>
  ),
};

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        "prose-headings:font-serif prose-headings:font-bold",
        "prose-p:leading-relaxed prose-li:leading-relaxed",
        "prose-code:before:content-none prose-code:after:content-none",
        "prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-[0.85em]",
        "prose-pre:bg-muted prose-pre:border",
        "prose-table:text-sm prose-table:my-0",
        "prose-th:whitespace-nowrap",
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{content}</ReactMarkdown>
    </div>
  );
}
