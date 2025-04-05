export declare global {
  const SteamClient: {
    Updates: {
      RegisterForUpdateStateChanges(callback: (e: Uint8Array) => void): object;
      CheckForUpdates: () => Promise<object>;
      ApplyUpdates: (serializeBase64String: string) => Promise<object>;
    };
    User: {
      // Patched from SteamClient.User.StartRestart() to SteamClient.User.StartShutdown(boolean)
      StartRestart: (arg: boolean) => Promise<void>;
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
