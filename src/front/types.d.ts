/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />
import {IpcRendererApis} from '../types';

declare global {
  interface Window {
    ipcRenderer: IpcRendererApis;
  }
}
