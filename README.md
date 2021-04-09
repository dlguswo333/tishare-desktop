# SendDone-Desktop
This is a reporitory for SendDone, desktop version.<br>

## How to Run Debug
```bash
# Run react in localhost.
npm start
# Electron will load web page the above.
npm run electron
```

## How to Build in Production
```bash
# Run react build
npm start
# electron-builder will build into executables or installers. Refer to its document for detail.
npx electron-builder --win --x64
```
