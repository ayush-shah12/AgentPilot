import { app } from 'electron';

export const isDev = process.env.APP_ENV === 'development' || !app.isPackaged;