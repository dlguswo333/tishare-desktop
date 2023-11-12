import { useCallback } from 'react';

const ipcRenderer = window.ipcRenderer;

/**
 * @param {Object} props
 * @param {boolean} props.isServerOpen
 * @param {() => Promise<void>} props.closeServer
 * @param {(networks: (import('../component/App').Network)[]) => void} props.setNetworks
 *
 */
const useNetworks = ({ isServerOpen, closeServer, setNetworks }) => {
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
  }
}

export default useNetworks;
