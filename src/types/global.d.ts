declare global {
  interface Window {
    NotificationStore: any;
  }

  type UnregisterFunction = () => void;
}

export {};
