import { useCallback, useEffect, useRef, useState } from "react";

import { ChatSocket, type ConnectionStatus } from "@/services/chatSocket";

export type ChatSocketHandle = {
  status: ConnectionStatus;
  send: (payload: object) => void;
};

export function useChatSocket(opts: {
  url: string | null;
  onMessage: (msg: unknown) => void;
}): ChatSocketHandle {
  const { url } = opts;
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const socketRef = useRef<ChatSocket | null>(null);

  // Keep a ref to the latest onMessage so the socket lifecycle doesn't depend on it
  const onMessageRef = useRef(opts.onMessage);
  onMessageRef.current = opts.onMessage;

  useEffect(() => {
    if (!url) {
      socketRef.current?.close();
      socketRef.current = null;
      setStatus("idle");
      return;
    }

    const socket = new ChatSocket(url);
    socketRef.current = socket;

    const offMsg = socket.onMessage((m) => onMessageRef.current(m));
    const offStatus = socket.onStatus(setStatus);
    socket.connect();

    return () => {
      offMsg();
      offStatus();
      socket.close();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [url]);

  const send = useCallback((payload: object) => {
    socketRef.current?.send(payload);
  }, []);

  return { status, send };
}