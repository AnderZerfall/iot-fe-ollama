import type { ConnectionStatus } from "../types";
import { RefreshCw, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Switch } from "./ui/switch";

type ChatHeaderProps = {
  host: string;
  setHost: (host: string) => void;
  models: string[];
  model: string;
  setModel: (model: string) => void;
  status: ConnectionStatus;
  think: boolean;
  setThink: (think: boolean) => void;
  onRefresh: () => void;
  onClear: () => void;
  canClear: boolean;
};

export default function ChatHeader({
  host,
  setHost,
  models,
  model,
  setModel,
  status,
  think,
  setThink,
  onRefresh,
  onClear,
  canClear,
}: ChatHeaderProps) {
  const statusTitle =
    status === "ok"
      ? "Connected"
      : status === "bad"
        ? "Connection unavailable"
        : "";

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
      <h1 className="mr-1 text-base font-semibold">Ollama Chat</h1>
      <span className={`dot ${status}`} title={statusTitle} aria-label={statusTitle} />
      <Input
        type="text"
        className="h-10 min-w-0 flex-1 basis-52"
        value={host}
        aria-label="Ollama address"
        onChange={(event) => setHost(event.target.value)}
        onBlur={onRefresh}
        onKeyDown={(event) => {
          if (event.key === "Enter") onRefresh();
        }}
      />
      <Select value={model} onValueChange={setModel}>
        <SelectTrigger className="w-full sm:w-48" aria-label="Model">
          <SelectValue placeholder="No models available" />
        </SelectTrigger>
        <SelectContent>
          {models.length === 0 ? (
            <SelectItem value="no-models" disabled>
              No models available
            </SelectItem>
          ) : (
            models.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" onClick={onRefresh}>
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        Refresh
      </Button>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <Switch
          checked={think}
          onCheckedChange={setThink}
          aria-label="Thinking"
        />
        Thinking
      </label>
      <Button variant="ghost" size="sm" onClick={onClear} disabled={!canClear}>
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Clear
      </Button>
    </header>
  );
}
