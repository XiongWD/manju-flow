type BroadcastHandler = (data: any) => void;

class TabSync {
  private channel: BroadcastChannel | null = null;
  private handlers: Map<string, BroadcastHandler[]> = new Map();

  constructor(channelName = "manju-sync") {
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      this.channel = new BroadcastChannel(channelName);
      this.channel.onmessage = (event) => {
        const { type, data } = event.data;
        const handlers = this.handlers.get(type) || [];
        handlers.forEach((h) => h(data));
      };
    }
  }

  on(type: string, handler: BroadcastHandler): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type)!.push(handler);
    return () => {
      const list = this.handlers.get(type);
      if (list) {
        const idx = list.indexOf(handler);
        if (idx >= 0) list.splice(idx, 1);
      }
    };
  }

  emit(type: string, data: any): void {
    this.channel?.postMessage({ type, data });
  }

  destroy(): void {
    this.channel?.close();
  }
}

export const tabSync = new TabSync();
