import { useCallback, useEffect, useRef, useState } from "react";
import { LatexGenerationStatus } from "@/lib/websocket";

interface UseWebSocketProps {
  autoConnect?: boolean;
}

interface UseWebSocketReturn {
  socket: null;
  connected: boolean;
  latexStatus: LatexGenerationStatus | null;
  startLatexGeneration: (
    files: File[],
    processType: string,
    modelType: string,
    customPrompt: string,
  ) => void;
  error: string | null;
}

const parseErrorMessage = async (response: Response) => {
  try {
    const data = await response.json();
    if (typeof data?.error === "string") return data.error;
    if (typeof data?.message === "string") return data.message;
    if (typeof data?.type === "string" && typeof data?.error === "string") {
      return `${data.type}: ${data.error}`;
    }
  } catch (error) {
    // ignore JSON parse errors
  }

  try {
    const text = await response.text();
    if (text) return text;
  } catch (error) {
    // ignore text parse errors
  }

  return `Request failed with status ${response.status}`;
};

const parseSseStream = async (
  response: Response,
  onStatus: (status: LatexGenerationStatus) => void,
  onError: (message: string) => void,
  signal: AbortSignal,
) => {
  if (!response.body) {
    onError("Streaming response body is missing");
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (signal.aborted) break;

    buffer += decoder.decode(value, { stream: true });

    let separatorIndex = buffer.indexOf("\n\n");
    while (separatorIndex !== -1) {
      const rawEvent = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);

      const dataLines = rawEvent
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.replace(/^data:\s?/, ""));

      for (const dataLine of dataLines) {
        if (!dataLine) continue;
        try {
          const payload = JSON.parse(dataLine) as LatexGenerationStatus;
          onStatus(payload);
          if (payload.status === "error" && payload.error) {
            onError(payload.error);
          }
        } catch (error) {
          onError("Failed to parse streaming response");
        }
      }

      separatorIndex = buffer.indexOf("\n\n");
    }
  }
};

const CLIENT_MAX_BYTES = 20 * 1024 * 1024; // 20MB
const MAX_DIMENSION = 2000;
const JPEG_QUALITY = 0.82;

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for compression"));
    };
    img.src = url;
  });

const compressImage = async (file: File): Promise<File> => {
  if (!file.type.startsWith("image/")) return file;

  const img = await loadImage(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  const targetWidth = Math.max(1, Math.round(img.width * scale));
  const targetHeight = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
  });

  if (!blob) return file;

  if (blob.size >= file.size * 0.95) {
    return file;
  }

  const newName = file.name.replace(/\.[^.]+$/, ".jpg");
  return new File([blob], newName, { type: "image/jpeg" });
};

const prepareFiles = async (files: File[]) => {
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes <= CLIENT_MAX_BYTES) return files;

  const compressed = await Promise.all(files.map((file) => compressImage(file)));
  const compressedBytes = compressed.reduce(
    (sum, file) => sum + file.size,
    0,
  );

  if (compressedBytes > CLIENT_MAX_BYTES) {
    throw new Error(
      `Files too large. Please keep uploads under ${Math.floor(
        CLIENT_MAX_BYTES / (1024 * 1024),
      )}MB total.`,
    );
  }

  return compressed;
};

export function useWebSocket({
  autoConnect = true,
}: UseWebSocketProps = {}): UseWebSocketReturn {
  const [connected, setConnected] = useState<boolean>(false);
  const [latexStatus, setLatexStatus] = useState<LatexGenerationStatus | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const startLatexGeneration = useCallback(
    async (
      files: File[],
      processType: string,
      modelType: string,
      customPrompt: string,
    ) => {
      if (!autoConnect) return;

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setConnected(true);
      setError(null);
      setLatexStatus({
        status: "thinking",
        content: "Preparing your request...",
      });

      try {
        const preparedFiles = await prepareFiles(files);
        const formData = new FormData();
        preparedFiles.forEach((file) =>
          formData.append("noteImage", file, file.name),
        );
        formData.append("processType", processType);
        formData.append("modelType", modelType);
        formData.append("customPrompt", customPrompt || "");

        const response = await fetch("/api/latex/generate", {
          method: "POST",
          body: formData,
          headers: {
            Accept: "text/event-stream",
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          const message = await parseErrorMessage(response);
          setError(message);
          setLatexStatus({
            status: "error",
            error: message,
          });
          return;
        }

        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("text/event-stream")) {
          await parseSseStream(
            response,
            setLatexStatus,
            setError,
            controller.signal,
          );
          return;
        }

        const data = await response.json();
        if (typeof data?.cleanedLatex === "string") {
          setLatexStatus({
            status: "complete",
            content: data.cleanedLatex,
            progress: 100,
          });
        } else {
          throw new Error("Unexpected response from server");
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        const message =
          err instanceof Error ? err.message : "Failed to generate LaTeX";
        setError(message);
        setLatexStatus({
          status: "error",
          error: message,
        });
      } finally {
        setConnected(false);
      }
    },
    [autoConnect],
  );

  return {
    socket: null,
    connected,
    latexStatus,
    startLatexGeneration,
    error,
  };
}
