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
# Option 1.
# Run react build
npm build
# electron-builder will build into executables or installers. Refer to its document for detail.
npx electron-builder --win --x64

# Option 2.
# Execute above with one npm script.
npm run builder
```
