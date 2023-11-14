import {useCallback, useEffect, useState} from 'react';

const ipcRenderer = window.ipcRenderer;

/**
 * @param {{setItems: React.Dispatch<React.SetStateAction<{}>>}} param0
 */
const useDragDrop = ({setItems}) => {
  const [isDragging, setIsDragging] = useState(false);

  const onDragOver = useCallback(
    /**
     * @param {DragEvent} e
     */
    (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (e.dataTransfer?.files)
        // Only show dragging effects if the event has files.
        setIsDragging(true);
    }, []);

  const onDragLeave = useCallback(
    /**
     * @param {DragEvent} e
     */
    (e) => {
      e.stopPropagation();
      e.preventDefault();
      // dragleave event fires on an element
      // when Blind component overlaps the element.
      // Checking if the target is Blind makes sure
      // that the mouse is out of entire window.
      if (e.target?.className === 'Blind') {
        setIsDragging(false);
      }
    }, []);

  const onDrop = useCallback(
    /**
     * @param {DragEvent} e
     */
    (e) => {
      e.stopPropagation();
      e.preventDefault();
      setIsDragging(false);
      if (!e.dataTransfer?.files)
        return;
      let paths = [];
      for (let f of e.dataTransfer.files) {
        paths.push(f.path);
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
