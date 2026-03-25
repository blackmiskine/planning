import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;

const isDev = !app.isPackaged;

function startBackend(): void {
  const backendPath = isDev
    ? path.join(__dirname, '../../backend/src/index.ts')
    : path.join(process.resourcesPath, 'backend/index.js');

  const command = isDev ? 'npx' : 'node';
  const args = isDev ? ['tsx', backendPath] : [backendPath];

  backendProcess = spawn(command, args, {
    cwd: isDev ? path.join(__dirname, '../../backend') : process.resourcesPath,
    env: {
      ...process.env,
      PORT: '3001',
      NODE_ENV: isDev ? 'development' : 'production',
      DB_PATH: isDev
        ? path.join(__dirname, '../../../data/planning.sqlite')
        : path.join(app.getPath('userData'), 'planning.sqlite'),
      JWT_SECRET: 'electron-local-secret-' + Date.now(),
    },
    stdio: 'pipe',
  });

  backendProcess.stdout?.on('data', (data) => {
    const msg = data.toString();
    if (msg.includes('Serveur d\u00e9marr\u00e9')) {
      createWindow();
    }
  });

  backendProcess.stderr?.on('data', (data) => {
    console.error('[Backend]', data.toString());
  });

  // Fallback : cr\u00e9er la fen\u00eatre apr\u00e8s un d\u00e9lai
  setTimeout(() => {
    if (!mainWindow) createWindow();
  }, 5000);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'Planning RH',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL('http://localhost:3001');
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  startBackend();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
});
