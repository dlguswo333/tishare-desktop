import {IpcRendererEvent, IpcMainInvokeEvent} from 'electron';

export type TiItemWithoutDir = {
  name: string;
  type: 'directory' | 'file';
  path: string;
  mtime?: Date;
  size: number;
}

export type TiItem = TiItemWithoutDir & {
  dir: string;
}

export type TiDevice = {
  id: string;
  os: string;
  ip: string;
  version: string;
}

export type IpcRendererApis = {
  openFile: () => Promise<Record<string, any>>,
  openDirectory: () => Promise<Record<string, any>>,
  dragAndDrop: (paths: string[]) => Promise<Record<string, any>>,
  getNetworks: () => Promise<{name:String, ip:String, netmask:String}[]>,
  openServer: (myIp: string, myNetmask: string) => Promise<boolean>,
  closeServer: () => Promise<boolean>,
  setMyId: (myId: string) => Promise<boolean>,
  isServerOpen: () => Promise<boolean>,
  scan: (myIp: string, netmask: string, myId: string) => void,
  scanCallback: (callback: (deviceIp: string, deviceVersion: string, deviceId: string, deviceOs: string) => void) => void,
  removeScanCallback: () => void,
  sendRequest: (items: Record<string, Tiitem>, receiverIp: string, receiverId: string) => void,
  preRecvRequest: (senderIp: string, senderId: string) => void,
  recvRequest: (ind: number, recvDir: string) => void,
  endJob: (ind: number) => Promise<boolean>,
  deleteJob: (ind: number) => Promise<boolean>,
  acceptSendRequest: (ind: number, recvDir: string) => void,
  acceptRecvRequest: (ind: number, items: Record<string, TiItem>) => void,
  rejectRequest: (ind: number) => void,
  setRecvDir: () => Promise<string | null>,
  showMessage: (message: string) => void,
  onNumJobs: (callback: (numJobs: number) => void) => void,
  removeNumJobsCallback: () => void,
  onJobState: (callback: (job: any) => void) => void,
  removeJobStateCallback: () => void,
  onDeleteJobState: (callback: (ind: number) => void) => void,
  removeDeleteJobStateCallback: () => void,
  getFilePaths: (files: File[]) => string[] | undefined,
}
