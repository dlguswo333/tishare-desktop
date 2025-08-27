import {useCallback} from 'react';

type Props = {
  myIp: string | null;
  myNetmask: string | null;
}

const ipcRenderer = window.ipcRenderer;

const useServer = ({myIp, myNetmask}: Props) => {
  const openServer = useCallback(async () => {
    if (!(myIp && myNetmask)) {
      throw new Error('Cannot open server: IP is not valid');
    }
    const ret = await ipcRenderer.openServer(myIp, myNetmask);
    if (!ret)
      console.error('tried to open server but returned false');
  }, [myIp, myNetmask]);

  const closeServer = useCallback(async () => {
    const ret = await ipcRenderer.closeServer();
    if (!ret)
      console.error('tried to open server but returned false');
  }, []);

  return {
    openServer,
    closeServer,
  };
};

export default useServer;
