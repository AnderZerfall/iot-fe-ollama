import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, ConnectionStatus, SelectedImage } from "../types";

const DEFAULT_HOST = "http://localhost:11434";

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export function useOllamaChat() {
  const [host, setHost] = useState(DEFAULT_HOST);
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [think, setThink] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [image, setImage] = useState<SelectedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const loadModels = useCallback(async (currentHost: string) => {
    try {
      const response = await fetch(
        `${currentHost.replace(/\/+$/, "")}/api/tags`,
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = (await response.json()) as {
        models: Array<{ name: string }>;
      };
      const names = data.models.map((item) => item.name);
      setModels(names);
      setStatus("ok");
      setModel((currentModel) =>
        names.includes(currentModel) ? currentModel : (names[0] ?? ""),
      );
    } catch {
      setModels([]);
      setStatus("bad");
    }
  }, []);

  useEffect(() => {
    const savedHost = localStorage.getItem("ollama_host") || DEFAULT_HOST;
    setHost(savedHost);
    setModel(localStorage.getItem("ollama_model") || "");
    void loadModels(savedHost);
  }, [loadModels]);

  useEffect(() => {
    if (host !== DEFAULT_HOST || localStorage.getItem("ollama_host")) {
      localStorage.setItem("ollama_host", host);
    }
  }, [host]);

  useEffect(() => {
    if (model) localStorage.setItem("ollama_model", model);
  }, [model]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const pickImage = async (file?: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    setImage({ b64: await fileToBase64(file), url: URL.createObjectURL(file) });
  };

  const patchLastMessage = (update: (message: ChatMessage) => ChatMessage) =>
    setMessages((currentMessages) =>
      currentMessages.map((message, index) =>
        index === currentMessages.length - 1 ? update(message) : message,
      ),
    );

  const send = async () => {
    const text = input.trim();
    if ((!text && !image) || busy || !model) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: text || "What is shown in this image?",
    };
    if (image) {
      userMessage.images = [image.b64];
      userMessage.preview = image.url;
    }

    const history = [
      ...messages.filter((message) => message.role !== "error"),
      userMessage,
    ];
    setMessages([
      ...history,
      { role: "assistant", content: "", thinking: "", streaming: true },
    ]);
    setInput("");
    setImage(null);
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let requestHistory = history.map(({ role, content, images }) => ({
        role,
        content,
        ...(images ? { images } : {}),
      }));
      let omittedHistory = false;
      let response: Response;

      for (;;) {
        response = await fetch(`${host.replace(/\/+$/, "")}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            stream: true,
            ...(think ? { think: true } : {}),
            messages: requestHistory,
          }),
        });

        if (response.ok && response.body) break;

        let detail = "";
        try {
          const data = (await response.json()) as { error?: string };
          detail = data.error ?? "";
        } catch (error) {
          if (!(error instanceof SyntaxError)) throw error;
        }

        const isContextError =
          /exceeds the available context size|context length|context window/i.test(
            detail,
          );
        if (!isContextError || requestHistory.length <= 1) {
          throw new Error(
            `HTTP ${response.status}${detail ? `: ${detail}` : ""}`,
          );
        }

        const oldestUserIndex = requestHistory.findIndex(
          (message) => message.role === "user",
        );
        const currentUserIndex = requestHistory.length - 1;
        if (oldestUserIndex < 0 || oldestUserIndex >= currentUserIndex) {
          throw new Error(
            `HTTP ${response.status}${detail ? `: ${detail}` : ""}`,
          );
        }
        const nextAssistantIndex = requestHistory.findIndex(
          (message, index) =>
            index > oldestUserIndex && message.role === "assistant",
        );
        const removeThrough =
          nextAssistantIndex > -1 && nextAssistantIndex < currentUserIndex
            ? nextAssistantIndex
            : oldestUserIndex;
        requestHistory = requestHistory.filter(
          (_, index) => index < oldestUserIndex || index > removeThrough,
        );
        omittedHistory = true;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const chunk = JSON.parse(line);
          if (chunk.error) throw new Error(chunk.error);
          const message = chunk.message ?? {};
          patchLastMessage((lastMessage) => ({
            ...lastMessage,
            content: lastMessage.content + (message.content ?? ""),
            thinking: (lastMessage.thinking ?? "") + (message.thinking ?? ""),
          }));
        }
      }
      patchLastMessage((lastMessage) => ({
        ...lastMessage,
        streaming: false,
        ...(omittedHistory
          ? { notice: "Older messages were omitted to fit the model's context." }
          : {}),
      }));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        patchLastMessage((lastMessage) => ({
          ...lastMessage,
          streaming: false,
        }));
      } else {
        const errorMessage =
          error instanceof TypeError
            ? "Could not connect. Check the address, make sure `ollama serve` is running, and verify OLLAMA_ORIGINS is set."
            : error instanceof Error
              ? error.message
              : String(error);
        setMessages((currentMessages) => [
          ...currentMessages.slice(0, -1),
          { role: "error", content: errorMessage },
        ]);
        setStatus("bad");
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();
  const clearMessages = () => setMessages([]);

  return {
    host,
    setHost,
    models,
    model,
    setModel,
    status,
    think,
    setThink,
    messages,
    input,
    setInput,
    image,
    setImage,
    busy,
    endRef,
    loadModels,
    pickImage,
    send,
    stop,
    clearMessages,
  };
}
