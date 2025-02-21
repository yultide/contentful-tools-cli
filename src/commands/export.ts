import { createClientFromConfig, getContentTypes, getEntries, getFilteredFields, openFile } from '@/utils/contentful';
import allLocales from '@/utils/contentful-locales';
import { createWorkbook, Row, saveWorkbook } from '@/utils/excel';
import chalk from 'chalk';
import { Command } from 'commander';
import { Link } from 'contentful-management';
import path from 'node:path';

export function command(program: Command): Command {
	program
		.command('export')
		.argument('<entry-ids>', 'Comman separated entry ids')
		.argument('[file]', 'Output XLSX filename')
		.option('-r, --recursive', 'recursively search entry', false)
		.description('Export contentful entries to xlsx spreadsheet')
		.action(async (entryIds, file, options) => {
			console.log('import', entryIds, file, options);
			const client = await createClientFromConfig();
			let ids = entryIds.split(',');
			ids = [...new Set(ids)]; // make unique

			// fetch all the content types
			const contentTypesList = await getContentTypes(client);
			const contentTypes = new Map(contentTypesList.map((ct) => [ct.sys.id, ct]));

			// download entries in chunks
			const entries = await getEntries(client, ids);

			const rows: Row[] = [];

			for (const entry of entries) {
				const contentType = contentTypes.get(entry.sys.contentType.sys.id);
				const fields = getFilteredFields(contentType, []);

				let id = getEntryId(entry.sys.id, false);
				const ct = contentType?.sys.id || '';

				for (const field of fields) {
					const row: Row = {
						id: id,
						model: ct,
						field: field.id,
					};
					// skip any fields without an english value
					const enValue = entry.fields[field.id]?.['en-US'];
					if (enValue === undefined || enValue === null) {
						continue;
					}
					// clear the id to make xlsx easier to read
					id = '';
					for (const locale of allLocales) {
						const value = processValue(entry.fields[field.id]?.[locale], field.type, false, false);
						if (value) {
							row[locale] = value;
						}
					}
					rows.push(row);
				}

				if ((entry.metadata?.tags?.length || 0) > 0) {
					const tags = entry.metadata?.tags.map((t) => t.sys.id);
					const metaRow = {
						id,
						model: entry.sys.contentType.sys.id,
						field: 'metadata',
						'en-US': `tags:${tags?.join(',')}`,
					};
					rows.push(metaRow);
				}
			}

			// let saveFileName = args.file;
			// if (saveFileName === DEFAULT_FILENAME) {
			// 	const parts = path.parse(saveFileName);
			// 	saveFileName = `${parts.name}-${entryIds[0] || 'noentry'}${parts.ext}`;
			// }

			// if (args.includeAssets) {
			// 	const assetPath = `./assets-${saveFileName}`;
			// 	mkdirp(assetPath);
			// 	for (const assetId of assetIds) {
			// 		const asset = await env.getAsset(assetId);
			// 		const { url } = asset.fields.file['en-US'];
			// 		if (url) {
			// 			const publicUrl = url.replace('secure.ctfassets.net', 'ctfassets.net');
			// 			const filename = `${asset.sys.id}-${path.basename(url)}`;
			// 			const assetLoadFilepath = path.join(assetPath, filename);
			// 			await downloadFile(publicUrl, assetLoadFilepath);
			// 			console.log(`asset ${chalk.yellow(asset.sys.id)} ${chalk.blue(assetLoadFilepath)}`);
			// 		}
			// 	}
			// }

			const saveFileName = file;

			if (rows.length) {
				const wb = createWorkbook({ 'dm batcheditexport': rows });
				console.log(`Saving ${chalk.cyan(saveFileName)} with ${chalk.yellow(`${entries.length} entries`)}`);
				await saveWorkbook(wb, saveFileName);

				// open browser
				openFile(path.resolve(saveFileName));
			} else {
				console.log('No file created. Could not find entries.');
			}

			// const filename = file || `ctf-export-${entryIds[0]}.xlsx`;
			// for (const id of ids) {
			// 	const e = await client.getEntry(id);
			// 	console.log(e.sys.id, getName(e));
			// }
		});

	return program;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getEntryId(entry: string, useTemplate: boolean) {
	// if (useTemplate) {
	// 	const e = entryToNewId[entry];
	// 	if (e) {
	// 		return e;
	// 	}
	// 	const newId = `new-${lastNewEntryId}`;
	// 	lastNewEntryId += 1;
	// 	entryToNewId[entry] = newId;
	// 	return newId;
	// }
	return entry;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function processValue(value: unknown, type: string, template: boolean, jsonRichText: boolean): string | undefined {
	if (value === undefined || value === null) return undefined;

	switch (type) {
		case 'Text':
		case 'Symbol':
			return value as string;
		case 'Integer':
			return `number:${value}`;
		case 'RichText':
			// if (jsonRichText) {
			// 	return `json:${JSON.stringify(value)}`;
			// }
			// return `markdown:${richTextToMarkdown(value as Document)}`;
			return `json:${JSON.stringify(value)}`;
		case 'Object':
		case 'Array': {
			const arrayValue = value as Link<'Asset'>[];
			if (arrayValue[0]?.sys?.id) {
				const linkType = arrayValue[0]?.sys?.linkType || 'Entry';
				if (linkType === 'Asset') {
					return `assets:${arrayValue.map((i) => i.sys.id).join(',')}`;
				}
				return `links:${arrayValue.map((i) => getEntryId(i.sys.id, template)).join(',')}`;
			}
			const stringArray = value as string[];
			if (typeof stringArray[0] === 'string') {
				return `array:${stringArray.join(',')}`;
			}
			return `json:${JSON.stringify(value)}`;
		}
		case 'Link': {
			const linkValue = value as Link<'Asset'>;
			if (linkValue.sys.linkType === 'Asset') {
				return `asset:${linkValue.sys.id}`;
			}
			return `link:${getEntryId(linkValue.sys.id, template)}`;
		}
		case 'Number':
			return `number:${value}`;
		case 'Boolean':
			return `bool:${value === true}`;
		default:
			return value as string;
	}
}
