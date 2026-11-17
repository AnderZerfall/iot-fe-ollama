import { Trash2 } from "lucide-react";
import type { ChatLogEntry } from "../types";
import { Button } from "./ui/button";

type ActivityLogProps = {
  logs: ChatLogEntry[];
  onClear: () => void;
};

export default function ActivityLog({ logs, onClear }: ActivityLogProps) {
  return (
    <section className="border-t border-border px-4 py-2">
      <div className="flex items-start gap-2">
        <details className="min-w-0 flex-1">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            Activity log ({logs.length})
          </summary>
          <div
            className="mt-2 max-h-40 overflow-y-auto rounded-md border border-border bg-card p-2"
            aria-live="polite"
          >
            {logs.length === 0 ? (
              <p className="text-xs text-muted-foreground">No activity yet.</p>
            ) : (
              <ol className="space-y-1">
                {logs.map((entry) => (
                  <li
                    key={entry.id}
                    className={`flex gap-2 text-xs ${
                      entry.level === "error"
                        ? "text-destructive"
                        : entry.level === "warn"
                          ? "text-primary"
                          : "text-muted-foreground"
                    }`}
                  >
                    <time
                      className="shrink-0"
                      dateTime={entry.timestamp}
                      title={new Date(entry.timestamp).toLocaleString()}
                    >
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </time>
                    <span className="break-words">{entry.message}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </details>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClear}
          disabled={logs.length === 0}
          aria-label="Clear activity log"
          title="Clear activity log"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}
