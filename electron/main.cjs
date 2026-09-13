const { app, BrowserWindow } = require("electron");
const { spawn } = require("child_process");
const path = require("path");

let serverProcess;
let mainWindow;

function startServer() {
  const serverPath = path.join(__dirname, "..", "dist", "server.cjs");

  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      NODE_ENV: "production",
      ELECTRON_RUN_AS_NODE: "1"
    },
    stdio: "inherit"
  });

  serverProcess.on("error", (error) => {
    console.error("Failed to start Orderly server:", error);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadURL("http://localhost:3000");
}

app.whenReady().then(() => {
  startServer();

  setTimeout(() => {
    createWindow();
  }, 1500);
});

app.on("window-all-closed", () => {
  if (serverProcess) {
    serverProcess.kill();
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
