// src/controllers/health.controller.ts
import { Request, Response } from 'express';
import { googleSheetsService } from '../services/googleSheets.service';

export async function getHealth(_req: Request, res: Response): Promise<void> {
  const sheetsHealth = await googleSheetsService.checkHealth();

  if (sheetsHealth.connected) {
    res.status(200).json({
      status: 'ok',
      storage: 'google_sheets',
      database: 'connected',
      spreadsheet: {
        title: sheetsHealth.title,
        tabs: sheetsHealth.tabs,
      },
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(503).json({
      status: 'error',
      storage: 'google_sheets',
      database: 'disconnected',
      error: sheetsHealth.error,
      timestamp: new Date().toISOString(),
    });
  }
}
