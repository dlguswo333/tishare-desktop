/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

interface Window {
  ipcRenderer: any
}

type Item = {
  name: string;
  type: 'directory' | 'file';
  path: string;
  mtime?: Date;
  size: number;
}

type Device = {
  id: string;
  os: string;
  ip: string;
  version: string;
}
