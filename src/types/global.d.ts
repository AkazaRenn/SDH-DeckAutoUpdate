export declare global {
  const SteamClient: {
    Updates: {
      RegisterForUpdateStateChanges(callback: (e) => void): object;
      CheckForUpdates: () => Promise<object>;
      ApplyUpdates: (serializeBase64String: string) => Promise<object>;
    };
    User: {
      StartRestart: () => Promise<void>;
    };
    System: {
      RestartPC: () => Promise<void>;
    }
  };

  interface Window {
    NotificationStore: any;
  }

  type UnregisterFunction = () => void;

  interface Unregisterable {
    unregister: UnregisterFunction;
  }
}
