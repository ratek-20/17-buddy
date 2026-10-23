import { api } from '@electron-forge/core';

const electronProcess = await api.start({
  dir: process.cwd(),
  interactive: false,
});

const exitCode = await new Promise((resolve) => {
  electronProcess.once('exit', (code) => resolve(code ?? 0));
});

process.exitCode = exitCode;
