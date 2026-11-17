import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ChatLogEntry,
  ChatMessage,
  ConnectionStatus,
  SelectedImage,
} from "../types";

const DEFAULT_HOST = "http://localhost:11434";

type TargetAddressSpace = "local";
type OllamaRequestInit = RequestInit & {
  targetAddressSpace?: TargetAddressSpace;
};

const getTargetAddressSpace = (address: string): TargetAddressSpace | undefined => {
  const hostname = new URL(address).hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "");

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "::1" ||
    hostname === "127.0.0.1" ||
    /^127(?:\.\d{1,3}){3}$/.test(hostname)
  ) {
    return "local";
  }

  const octets = hostname.split(".").map(Number);
  const isIpv4 = octets.length === 4 && octets.every(
    (octet, index) =>
      Number.isInteger(octet) &&
      octet >= 0 &&
      octet <= 255 &&
      String(octet) === hostname.split(".")[index],
  );
  const isPrivateIpv4 =
    isIpv4 &&
    (octets[0] === 10 ||
      octets[0] === 192 && octets[1] === 168 ||
      octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31 ||
      octets[0] === 169 && octets[1] === 254 ||
      octets[0] === 0);

  if (
    isPrivateIpv4 ||
    hostname.endsWith(".local") ||
    /^f[cd][0-9a-f]{2}:/i.test(hostname) ||
    /^fe[89ab][0-9a-f]:/i.test(hostname)
  ) {
    return "local";
  }

  return undefined;
};

const getFetchErrorMessage = (error: unknown, address: string) => {
  if (!(error instanceof TypeError)) {
    return error instanceof Error ? error.message : String(error);
  }

  let targetOrigin: string;
  try {
    targetOrigin = new URL(address).origin;
  } catch {
    return `Invalid Ollama address: ${address}`;
  }
  return `The browser could not reach ${targetOrigin}. In Chrome, allow Local network access for ${window.location.origin} in Site settings. Also make sure Ollama allows this page's origin via OLLAMA_ORIGINS and is running on the computer opening this page.`;
};

const fetchOllama = (address: string, init?: RequestInit) => {
  const targetAddressSpace = getTargetAddressSpace(address);
  const requestInit: OllamaRequestInit = {
    ...init,
    ...(targetAddressSpace ? { targetAddressSpace } : {}),
  };
  return fetch(address, requestInit);
};

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
  const [logs, setLogs] = useState<ChatLogEntry[]>([]);
  const [input, setInput] = useState("");
  const [image, setImage] = useState<SelectedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback(
    (level: ChatLogEntry["level"], message: string) => {
      const timestamp = new Date().toISOString();
      const entry = { id: Date.now() + Math.random(), timestamp, level, message };
      setLogs((currentLogs) => [...currentLogs, entry].slice(-100));

      const consoleMessage = `[Ollama Chat] ${message}`;
      if (level === "error") {
        console.error(consoleMessage, { timestamp });
      } else if (level === "warn") {
        console.warn(consoleMessage, { timestamp });
      } else {
        console.info(consoleMessage, { timestamp });
      }
    },
    [],
  );

  const loadModels = useCallback(async (currentHost: string) => {
    const url = `${currentHost.replace(/\/+$/, "")}/api/tags`;
    addLog(
      "info",
      `Checking Ollama connection at ${url}.`,
    );
    try {
      const response = await fetchOllama(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = (await response.json()) as {
        models: Array<{ name: string }>;
      };
      const names = data.models.map((item) => item.name);
      setModels(names);
      setStatus("ok");
      addLog(
        "info",
        `Connected to Ollama. ${names.length} model${names.length === 1 ? "" : "s"} available.`,
      );
      setModel((currentModel) =>
        names.includes(currentModel) ? currentModel : (names[0] ?? ""),
      );
    } catch (error) {
      setModels([]);
      setStatus("bad");
      addLog(
        "error",
        `Could not load models: ${getFetchErrorMessage(error, url)}`,
      );
    }
  }, [addLog]);

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
    const requestStartedAt = Date.now();

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
    addLog(
      "info",
      `Sending chat request to model "${model}" with ${history.length} message${history.length === 1 ? "" : "s"}.`,
    );

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
        response = await fetchOllama(`${host.replace(/\/+$/, "")}/api/chat`, {
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
        addLog(
          "warn",
          "The request exceeded the model context. Retrying without the oldest conversation turn.",
        );

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
      addLog(
        "info",
        `Chat response completed in ${((Date.now() - requestStartedAt) / 1000).toFixed(1)}s.`,
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        patchLastMessage((lastMessage) => ({
          ...lastMessage,
          streaming: false,
        }));
        addLog("warn", "Chat request stopped by the user.");
      } else {
        const errorMessage =
          error instanceof TypeError
            ? getFetchErrorMessage(
                error,
                `${host.replace(/\/+$/, "")}/api/chat`,
              )
            : error instanceof Error
              ? error.message
              : String(error);
        setMessages((currentMessages) => [
          ...currentMessages.slice(0, -1),
          { role: "error", content: errorMessage },
        ]);
        setStatus("bad");
        addLog("error", `Chat request failed: ${errorMessage}`);
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();
  const clearMessages = () => {
    setMessages([]);
    addLog("info", "Chat history cleared.");
  };
  const clearLogs = () => setLogs([]);

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
    logs,
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
    clearLogs,
  };
}
