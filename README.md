
# tiShare-Desktop
<img src="https://raw.githubusercontent.com/dlguswo333/tishare-desktop/main/public/icon.png" width="300px"/>
<br>

This is a reporitory for tiShare, desktop version.<br>
tiShare has been inspired by my former team project, [SendDone](https://github.com/La-Beaute/SendDone-Desktop).
<br>

## How to Run in Development Mode
```bash
# Run react in localhost.
npm start
# Electron will load the web page above.
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
