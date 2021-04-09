import React, { useState, forwardRef, useImperativeHandle } from 'react';
const { ipcRenderer } = window;


const Path = forwardRef((props, ref) => {
  const refPath = React.createRef();
  const [label, setLabel] = useState('Path');
  // useImperativeHandle is needed to expose
  // the wrapped methods to the parents.
  // It should be used paired with forwardRef.
  useImperativeHandle(ref, () => ({
    getPath: () => {
      if (refPath.current)
        return refPath.current.value;
    },
    setPath: (path) => {
      if (refPath.current)
        return refPath.current.value = path;
    },
    showLabel: (message) => {
      setLabel(message);
      setTimeout(() => {
        setLabel('Path');
      }, 3000);
    }
  }));

  const setPath = (path) => {
    if (refPath.current)
      return refPath.current.value = path;
  };

  return (
    <div className="Box2">
      <div className="Box4">
        {label}
      </div>
      <div className="Box3">
        <input type="text" ref={refPath} className="PathInput" placeholder="Set Path">

        </input>
        <button onClick={async () => {
          const path = await ipcRenderer.invoke('select-path');
          if (path) {
            setPath(path);
          }
        }}>
          Set Path
        </button>
      </div>
    </div>
  );
});

export default Path;
