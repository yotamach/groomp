"use strict";
// GROOMP desktop shell — a minimal Electron wrapper around the game.
// The game itself is untouched; this just hosts index.html in a window.

const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1296,
    height: 880,
    useContentSize: true,
    autoHideMenuBar: true,
    backgroundColor: "#0a0a0c",
    title: "GROOMP",
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, "..", "index.html"));

  // F11 toggles fullscreen; Esc leaves fullscreen (pointer lock already
  // swallows the first Esc press, the second one reaches us here)
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F11") {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    } else if (input.key === "Escape" && win.isFullScreen()) {
      win.setFullScreen(false);
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  app.quit();
});
