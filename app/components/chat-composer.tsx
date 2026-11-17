import { useRef } from "react";
import { ImagePlus, Send, StopCircle, X } from "lucide-react";
import type { SelectedImage } from "../types";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

type ChatComposerProps = {
  input: string;
  setInput: (input: string) => void;
  image: SelectedImage | null;
  setImage: (image: SelectedImage | null) => void;
  busy: boolean;
  canSend: boolean;
  onPickImage: (file?: File) => Promise<void>;
  onSend: () => void;
  onStop: () => void;
};

export default function ChatComposer({
  input,
  setInput,
  image,
  setImage,
  busy,
  canSend,
  onPickImage,
  onSend,
  onStop,
}: ChatComposerProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <footer className="border-t border-border px-4 pb-4 pt-3">
      {image && (
        <div className="preview mb-2 flex items-center gap-2">
          <img src={image.url} alt="Image preview" />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setImage(null)}
            aria-label="Remove image"
            title="Remove image"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            void onPickImage(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          aria-label="Upload image"
          title="Upload image"
        >
          <ImagePlus className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Textarea
          className="min-h-10 max-h-44 min-w-0 flex-1 resize-none"
          rows={1}
          value={input}
          placeholder="Message..."
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
          onPaste={(event) => {
            const file = Array.from(event.clipboardData.files).find((item) =>
              item.type.startsWith("image/"),
            );
            if (file) {
              event.preventDefault();
              void onPickImage(file);
            }
          }}
        />
        {busy ? (
          <Button variant="outline" size="icon" onClick={onStop} aria-label="Stop" title="Stop">
            <StopCircle className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button
            onClick={onSend}
            disabled={!canSend}
            aria-label="Send message"
            title="Send message"
            size="icon"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>
      <div className="attribution">UI made by Anna Androschuk</div>
    </footer>
  );
}
