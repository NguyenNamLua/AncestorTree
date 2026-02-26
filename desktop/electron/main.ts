/**
 * @project AncestorTree Desktop
 * @file desktop/electron/main.ts
 * @description Electron main process — app lifecycle, window management, server start
 * @version 1.0.0
 * @updated 2026-02-26
 */

import { app, BrowserWindow, shell } from 'electron';
import * as path from 'path';
import { startServer, stopServer, getServerUrl } from './server';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Gia Phả Điện Tử',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    // macOS: show traffic lights in titlebar
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function loadApp(): Promise<void> {
  if (!mainWindow) return;

  const serverUrl = getServerUrl();
  if (serverUrl) {
    await mainWindow.loadURL(serverUrl);
  } else {
    // Show loading screen while server starts
    mainWindow.loadURL(`data:text/html,
      <html>
        <body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui;background:#0a0a0a;color:#fafafa">
          <div style="text-align:center">
            <h1>Gia Phả Điện Tử</h1>
            <p>Đang khởi động...</p>
          </div>
        </body>
      </html>
    `);
  }
}

app.whenReady().then(async () => {
  createWindow();
  await loadApp();

  // Start Next.js server
  try {
    const url = await startServer();
    console.log(`[AncestorTree] Server ready at ${url}`);
    if (mainWindow) {
      await mainWindow.loadURL(url);
    }
  } catch (err) {
    console.error('[AncestorTree] Failed to start server:', err);
    if (mainWindow) {
      mainWindow.loadURL(`data:text/html,
        <html>
          <body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui;background:#0a0a0a;color:#fafafa">
            <div style="text-align:center">
              <h1>Lỗi khởi động</h1>
              <p>Không thể khởi động server. Vui lòng thử lại.</p>
              <pre style="color:#ef4444;font-size:12px;max-width:600px;overflow:auto">${err}</pre>
            </div>
          </body>
        </html>
      `);
    }
  }

  // macOS: re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      loadApp();
    }
  });
});

// Quit when all windows are closed (except macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Graceful shutdown
app.on('before-quit', async () => {
  await stopServer();
});
