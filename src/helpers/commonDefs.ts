import Plugin from "../json/plugin.json";

export const PLUGIN_NAME: string = Plugin.name;
export const PLUGIN_NAME_NO_SPACE: string = Plugin.name.replaceAll(' ', '');
export const PLUGIN_NAME_AS_PATH: string = Plugin.name.replaceAll(' ', '-').toLowerCase();
