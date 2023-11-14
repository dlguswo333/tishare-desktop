import {useCallback} from 'react';

const ipcRenderer = window.ipcRenderer;

/**
 * @param {Object} props
 * @param {string} props.myIp
 * @param {string} props.myNetmask
 *
 */
const useServer = ({myIp, myNetmask}) => {
  const openServer = useCallback(async () => {
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
