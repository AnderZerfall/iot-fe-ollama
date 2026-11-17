export type ChatMessage = {
  role: "user" | "assistant" | "error";
  content: string;
  thinking?: string;
  images?: string[];
  preview?: string;
  streaming?: boolean;
  notice?: string;
};

export type SelectedImage = {
  b64: string;
  url: string;
};

export type ConnectionStatus = "idle" | "ok" | "bad";

export type ChatLogEntry = {
  id: number;
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
};
