// src/config/googleSheets.ts
import { google, sheets_v4 } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  clientEmail: string;
  privateKey: string;
}

let sheetsInstance: sheets_v4.Sheets | null = null;
let authClient: any = null;

export function getGoogleSheetsConfig(): GoogleSheetsConfig {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!spreadsheetId || !clientEmail || !privateKey) {
    const missing: string[] = [];
    if (!spreadsheetId) missing.push('GOOGLE_SHEETS_SPREADSHEET_ID');
    if (!clientEmail) missing.push('GOOGLE_SERVICE_ACCOUNT_EMAIL');
    if (!privateKey) missing.push('GOOGLE_PRIVATE_KEY');
    
    throw new Error(
      `Missing Google Sheets configuration in environment variables: ${missing.join(', ')}. Please check your .env file.`
    );
  }

  // Support single-line escaped newlines in .env (e.g. "-----BEGIN PRIVATE KEY-----\\n...")
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  // Remove surrounding quotes if present
  if (
    (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
    (privateKey.startsWith("'") && privateKey.endsWith("'"))
  ) {
    privateKey = privateKey.slice(1, -1);
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
  }

  return {
    spreadsheetId,
    clientEmail,
    privateKey,
  };
}

export function getSheetsClient(): { sheets: sheets_v4.Sheets; spreadsheetId: string } {
  const config = getGoogleSheetsConfig();

  if (!sheetsInstance || !authClient) {
    authClient = new google.auth.JWT({
      email: config.clientEmail,
      key: config.privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    sheetsInstance = google.sheets({
      version: 'v4',
      auth: authClient,
    });
  }

  return {
    sheets: sheetsInstance,
    spreadsheetId: config.spreadsheetId,
  };
}
