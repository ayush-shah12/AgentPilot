import { app } from 'electron';

export const isDev = process.env.APP_ENV === 'development' || !app.isPackaged;

/**
 * Common VM instance type for display and communication
 */
export interface VMInfo {
  /**
   * Unique identifier for the VM instance
   */
  id: string;

  /**
   * Display name of the VM
   */
  name: string;

  /**
   * Current operational status
   */
  status: 'initializing' | 'running' | 'paused' | 'stopped' | 'error';

  /**
   * URL to access the VM stream (only needed in VM instance windows)
   */
  streamURL?: string;

  /**
   * When the VM was created
   */
  createdAt?: Date;
}

/**
 * Resource statistics for VM monitoring
 */
export interface ResourceStats {
  /**
   * CPU usage percentage (0-100)
   */
  cpu: number;

  /**
   * Memory usage percentage (0-100)
   */
  memory: number;

  /**
   * Network I/O information
   */
  networkIO: string;
}
