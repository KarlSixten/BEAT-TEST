import 'dotenv/config'

import { google } from 'googleapis';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Discogs from 'disconnect';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const keyFilePath = path.join(__dirname, 'GOOGLE_AUTH.json');
const credentials = JSON.parse(await readFile(keyFilePath, 'utf-8'));

const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const spreadsheetId = process.env.SPREADSHEET_ID;
const range = 'Plader!C8:E13';

async function getPriceAndBarcodes() {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
    });

    const rows = res.data.values;

    if (!rows || !rows.length) {
        console.log('No data found.');
        return [];
    }

    return rows
        .map(row => ({
            price: row[0] || null,
            barcode: row[2] || null,
        }))
        .filter(entry => entry.barcode);
}

const discogs = new Discogs.Client({
    userToken: process.env.DISCOGS_TOKEN,
}); 
const database = discogs.database();

async function lookupBarcode(barcode) {
    try {
        const result = await database.search(barcode, { type: 'release', barcode });
        return result.results[0] || null;
    } catch (error) {
        console.error(`Error looking up barcode ${barcode}:`, error.message);
        return null;
    }
}

const entries = await getPriceAndBarcodes();
console.log(`Found ${entries.length} items with barcodes.`);

for (const { price, barcode } of entries) {
    const result = await lookupBarcode(barcode);
    
    if (result) {
        console.log({
            price,
            barcode,
            title: result.title,
            year: result.year,
            label: result.label?.[0],
            resource_url: result.resource_url,
            cover_url: result.cover_image
        });
    } else {
        console.log({
            price,
            barcode,
            title: 'Not found on Discogs',
        });
    }
}