import React, { useEffect, useState, useRef } from 'react';
import './App.css';
import Path from './Path';
const { ipcRenderer } = window;
var intervalHandle = null;


function App() {
  const [running, setRunning] = useState(false);
  const [progressString, setProgressString] = useState('');
  const refPath1 = useRef();
  const refPath2 = useRef();
  const refProgress = useRef();

  useEffect(() => {
    document.title = "Sync Folder";
    if (refPath1.current) {
      let path1 = window.localStorage.getItem('path1');
      refPath1.current.setPath(path1 ? path1 : '');
    }
    if (refPath2.current) {
      let path2 = window.localStorage.getItem('path2');
      refPath2.current.setPath(path2 ? path2 : '');
    }
    intervalHandle = setInterval(() => {
      if (running) {
        ipcRenderer.send('progress');
      }
    }, 200);
    ipcRenderer.on('progress', (event, arg) => {
      if (running) {
        let numCopied = arg.numCopied;
        let numTotal = arg.numTotal;
        if (!refProgress.current) {
          // If ref is not loaded yet, get out.
          return;
        }
        if (numTotal >= 0) {
          setProgressString(numCopied + ' / ' + numTotal);
          if (numTotal > 0) {
            if (refProgress.current)
              refProgress.current.value = numCopied / numTotal;
          }
          if (numCopied === numTotal) {
            // Done synchronizing.

            refProgress.current.value = 1;
            if (intervalHandle)
              clearInterval(intervalHandle);
            setTimeout(() => {
              setRunning(false);
            }, 3000);
          }
        }
      }
    });
  });

  const syncFolder = async () => {
    if (refPath1.current && refPath2.current) {
      const path1 = refPath1.current.getPath();
      const path2 = refPath2.current.getPath();
      if (!path1 || !path2) {
        if (!path1) {
          refPath1.current.showLabel('Path is empty!');
        }
        if (!path2) {
          refPath2.current.showLabel('Path is empty!');
        }
        return;
      }
      if (refProgress.current)
        refProgress.current.value = 0;

      // Save paths in localStorage for later use.
      window.localStorage.setItem('path1', path1);
      window.localStorage.setItem('path2', path2);

      setRunning(true);
      // Ask main to synchronize folders and wait.
      await ipcRenderer.invoke('sync-folder', path1, path2);
    }
    else {
      ipcRenderer.invoke('ERROR', 'Could not find references!');
    }
  };

  return (
    <div className="App">
      <div className="Box1">
        <Path ref={refPath1}>

        </Path>
        <Path ref={refPath2}>

        </Path>
        <button onClick={syncFolder} disabled={running}>
          Sync
        </button>
      </div>
      {running &&
        <div className="Box1">
          <progress className="Progress" max={1} ref={refProgress}>

          </progress>
          <div className="Box5">
            {progressString}
          </div>
        </div>
      }
    </div >
  );
};

export default App;
