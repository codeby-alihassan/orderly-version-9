const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const http = require("http");

const PORT = 3000;
let mainWindow;

function startServer() {
  process.env.NODE_ENV = "production";

  // Database ko Windows ke writable AppData folder mein rakho
  process.env.DATA_DIR = path.join(app.getPath("userData"), "data");

  // Production frontend ka exact path
  process.env.DIST_PATH = path.join(app.getAppPath(), "dist");

  const serverPath = path.join(
    app.getAppPath(),
    "dist",
    "server.cjs"
  );

  require(serverPath);
}

function waitForServer(retries = 60) {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(
        `http://127.0.0.1:${PORT}/api/health`,
        (res) => {
          res.resume();

          if (res.statusCode === 200) {
            resolve();
          } else {
            retry();
          }
        }
      );

      req.on("error", retry);

      req.setTimeout(1000, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (retries-- <= 0) {
        reject(
          new Error("Orderly POS server did not start.")
        );
      } else {
        setTimeout(attempt, 500);
      }
    };

    attempt();
  });
}

async function createWindow() {
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

  await waitForServer();

  await mainWindow.loadURL(
    `http://127.0.0.1:${PORT}`
  );
}

app.whenReady().then(async () => {
  try {
    startServer();
    await createWindow();
  } catch (error) {
    console.error(error);

    dialog.showErrorBox(
      "Orderly POS",
      `Application failed to start.\n\n${error.message}`
    );

    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow();
  }
});
