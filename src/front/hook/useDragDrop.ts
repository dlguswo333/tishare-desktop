import {useCallback, useEffect, useState} from 'react';

type Props = {
  setItems: React.Dispatch<React.SetStateAction<{}>>;
}

const ipcRenderer = window.ipcRenderer;

const useDragDrop = ({setItems}: Props) => {
  const [isDragging, setIsDragging] = useState(false);

  const onDragOver = useCallback(
    (e: DragEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (e.dataTransfer?.files)
        // Only show dragging effects if the event has files.
        setIsDragging(true);
    }, []);

  const onDragLeave = useCallback(
    (e: DragEvent) => {
      e.stopPropagation();
      e.preventDefault();
      // dragleave event fires on an element
      // when Blind component overlaps the element.
      // Checking if the target is Blind makes sure
      // that the mouse is out of entire window.
      if (e.target instanceof HTMLElement && e.target.className === 'Blind') {
        setIsDragging(false);
      }
    }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsDragging(false);
      if (!e.dataTransfer?.files)
        return;
      // e.dataTransfer.files is different from normal Array; convert it into one.
      let paths = ipcRenderer.getFilePaths([...e.dataTransfer.files]);
      if (!paths) {
        ipcRenderer.showMessage('Unknown error occured. Could not retrieve files\' paths.');
        return;
      }
      ipcRenderer.dragAndDrop(paths).then((ret) => {
        setItems((items) => Object.assign({}, ret, items));
      }).catch(() => {
        ipcRenderer.showMessage('Unknown error occurred.');
      });
    }, [setItems]);

  useEffect(() => {
    window.ondragover = onDragOver;
    window.ondragleave = onDragLeave;
    window.ondrop = onDrop;

    return () => {
      window.ondragover = null;
      window.ondragleave = null;
      window.ondrop = null;
    };
  }, [onDragOver, onDragLeave, onDrop]);

  return {
    isDragging
  };
};

export default useDragDrop;
