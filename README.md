
# tiShare-Desktop
<img src="https://raw.githubusercontent.com/dlguswo333/tishare-docs/main/public/logo.svg" width="256px"/>
<br>

<img src="https://dlguswo333.github.io/tishare-docs/desktop-run.png" width="960px"/>
<br>

This is a reporitory for tiShare, desktop version.<br>
tiShare has been inspired by my former team project, [SendDone](https://github.com/La-Beaute/SendDone-Desktop).
<br>

tiShare aims to help users transfer both files and folders across cross-platform devices.<br>
Checkout for more [Documentaiton](https://dlguswo333.github.io/tishare-docs) for more information and FAQ.
<br>

## How to Run in Development Mode
```bash
# Option 1.
# Run front dev server in localhost.
npm run start:front
# Electron will load the web page above.
npm run start:back

# Option 2.
# Execute above with one npm script.
npm start
```

## How to Build in Production
```bash
# Option 1.
# Run front build.
npm run build:front
# electron-builder will build into executables or installers. Refer to its document for detail.
npm run build:back

# Option 2.
# Execute above with one npm script.
npm run build
```

## Implementation
If you want to know more about the implementation behind tiShare,
You can read [README in src directory](src/README.md).
