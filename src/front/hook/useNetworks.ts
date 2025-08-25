import {useCallback} from 'react';
import type {Network} from '../component/App';

type Props = {
  isServerOpen: boolean;
  closeServer: () => Promise<void>;
  setNetworks: (networks: Network[]) => void;
}

const ipcRenderer = window.ipcRenderer;

const useNetworks = ({isServerOpen, closeServer, setNetworks}: Props) => {
  const getNetworks = useCallback(async () => {
    // Close server before refreshing networks.
    if (isServerOpen)
      await closeServer();
    const ret = await ipcRenderer.getNetworks();
    if (ret)
      setNetworks(ret);
  }, [isServerOpen, closeServer, setNetworks]);

  return {
    getNetworks,
  };
};

export default useNetworks;
