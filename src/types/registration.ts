import { Unregisterable } from "@decky/ui/dist/globals/steam-client/shared";

export default abstract class Registeration {
  private _registered = false;
  public get registered(): boolean {
    return this._registered;
  }

  protected abstract _register(): UnregisterFunction;

  public register(): Unregisterable {
    if (this._registered) {
      throw new Error(`${this.constructor.name} is already registered`);
    }

    const unregisterFunction = this._register();
    this._registered = true;
    return {
      unregister: unregisterFunction,
    }
  }
}
