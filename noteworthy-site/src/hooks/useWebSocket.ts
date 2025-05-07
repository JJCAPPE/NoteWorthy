import { useState, useEffect, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { LatexGenerationStatus } from "@/lib/websocket";

interface UseWebSocketProps {
  autoConnect?: boolean;
}

interface UseWebSocketReturn {
  socket: Socket | null;
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

export function useWebSocket({
  autoConnect = true,
}: UseWebSocketProps = {}): UseWebSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [latexStatus, setLatexStatus] = useState<LatexGenerationStatus | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  // Connect to WebSocket server
  useEffect(() => {
    if (!autoConnect) return;

    const socketUrl =
      process.env.NODE_ENV === "production"
        ? "https://noteworthy-site.vercel.app"
        : "http://localhost:3000";

    const socketInstance = io(socketUrl, {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      autoConnect: true,
    });

    socketInstance.on("connect", () => {
      console.log("WebSocket connected");
      setConnected(true);
      setError(null);
    });

    socketInstance.on("disconnect", () => {
      console.log("WebSocket disconnected");
      setConnected(false);
    });

    socketInstance.on("connect_error", (err) => {
      console.error("WebSocket connection error:", err);
      setError(`Connection error: ${err.message}`);
    });

    socketInstance.on(
      "latexGenerationStatus",
      (status: LatexGenerationStatus) => {
        setLatexStatus(status);

        if (status.status === "error" && status.error) {
          setError(status.error);
        }
      },
    );

    setSocket(socketInstance);

    // Cleanup on unmount
    return () => {
      socketInstance.off("connect");
      socketInstance.off("disconnect");
      socketInstance.off("connect_error");
      socketInstance.off("latexGenerationStatus");
      socketInstance.close();
    };
  }, [autoConnect]);

  // Function to start LaTeX generation
  const startLatexGeneration = useCallback(
    async (
      files: File[],
      processType: string,
      modelType: string,
      customPrompt: string,
    ) => {
      if (!socket || !connected) {
        setError("WebSocket not connected");
        return;
      }

      setLatexStatus({
        status: "thinking",
        content: "Preparing your request...",
      });

      try {
        // Convert files to buffers for transmission
        const fileBuffers = await Promise.all(
          files.map(async (file) => ({
            name: file.name,
            buffer: await file.arrayBuffer(),
            mimeType: file.type,
          })),
        );

        // Send the request
        socket.emit("startLatexGeneration", {
          files: fileBuffers,
          processType,
          modelType,
          customPrompt,
        });
      } catch (err) {
        console.error("Error preparing files:", err);
        setError(
          err instanceof Error ? err.message : "Failed to prepare files",
        );
        setLatexStatus({
          status: "error",
          error: "Failed to prepare files for transmission",
        });
      }
    },
    [socket, connected],
  );

  return {
    socket,
    connected,
    latexStatus,
    startLatexGeneration,
    error,
  };
}
