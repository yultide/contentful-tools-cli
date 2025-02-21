import chalk from 'chalk';
import exceljs from 'exceljs';
import fs from 'node:fs';
import { logger } from './logger';

export interface Row {
	[x: string]: string | undefined;
	id: string;
	model?: string;
	field?: string;
}

/**
 * Adjust the columns of the worksheet to match contents
 * From: https://stackoverflow.com/questions/63189741/how-to-autosize-column-width-in-exceljs
 * @param {Worksheet} worksheet
 * @param {number} maxColumnWidth optional
 */
export function adjustColumnWidth(worksheet: exceljs.Worksheet, maxColumnWidth = 200) {
	worksheet.columns.forEach((column) => {
		const widths = column.values?.map((v) => v?.toString().length).filter((v): v is number => true) || [];
		widths.push((column.header?.length || 0) + 6);
		const maxLength = Math.max(...widths);
		column.width = Math.min(maxColumnWidth, maxLength);
	});
}

/**
 * sleep using async/await
 * @param {number} ms - number of milliseconds to sleep
 */
export function sleep(ms: number) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

/**
 * Check if file is writeable
 * @param {string} filename
 */
export async function checkFileWriteable(filename: string) {
	const forever = true;
	while (forever) {
		try {
			if (fs.existsSync(filename)) {
				fs.openSync(filename, 'r+');
			}
			return;
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === 'EBUSY') {
				console.log(`  File ${chalk.cyan(filename)} is locked. Please close excel.`);
			}
		}
		await sleep(2000);
	}
}

/**
 * Create a workbook given a map of rows
 * @param {sheets:Record<string, Row[]>} map of sheet names to rows
 * @returns {exceljs.Workbook} workbook
 */
export function createWorkbook(sheets: Record<string, Row[]>) {
	const wb = new exceljs.Workbook();

	for (const name of Object.keys(sheets)) {
		const rows = sheets[name];
		const colSet = new Set<string>();
		rows.forEach((r) => {
			Object.keys(r).forEach((k) => colSet.add(k));
		});
		const columns = Array.from(colSet).map((s) => ({ key: s, header: s }));
		const ws = wb.addWorksheet(name);
		ws.columns = columns;
		ws.addRows(rows, 'i+');
		adjustColumnWidth(ws);
	}

	return wb;
}

/**
 * Save workbook.  Will wait until excel can write to the file.
 * @param {exceljs.Workbook} workbook - workbook to save
 * @param {string} filename - filename to save
 */
export async function saveWorkbook(workbook: exceljs.Workbook, filename: string, verbose = true) {
	await checkFileWriteable(filename);
	await workbook.xlsx.writeFile(filename);
	if (verbose) {
		logger.succeed(`workbook saved ${chalk.cyan(filename)}`);
	}
}
