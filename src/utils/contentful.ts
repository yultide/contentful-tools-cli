import { password, select } from '@inquirer/prompts';
import chalk from 'chalk';
import contentful, { Asset, ClientAPI, ContentType, Entry, Environment, QueryOptions } from 'contentful-management';
import { execSync } from 'node:child_process';
import { getConfig } from './config.js';

export const supportedLocales = ['en-US', ''];

/**
 * Create a management client with an access token
 * @param {string} token - default access token
 * @returns {ClientAPI}
 */
export function createClient(token: string) {
	return contentful.createClient({
		accessToken: token,
	});
}

/**
 * Create management client token in config
 * @returns {ClientAPI}
 */
export async function createClientFromConfig() {
	const config = getConfig();
	const client = createClient(config.cmaToken);
	const space = await client.getSpace(config.spaceId);
	const env = await space.getEnvironment(config.envId);
	return { client, space, env };
}

/**
 * Prompt user for a personal token with some instructions.
 *
 * @param {string} currentToken - Contentful user personal token
 */
export async function promptContentfulToken(currentToken = '') {
	console.log(`You can get the management token from here: ${chalk.cyan('https://app.contentful.com/account/profile/cma_tokens')}`);
	console.log(`Click on ${chalk.yellow('Generate personal token')}.  Remember to save your token.  You will not see it again.`);
	let prompt = 'Contentful Management Token';
	if (currentToken !== undefined && currentToken !== '') {
		const front = currentToken.substring(0, 4);
		const back = currentToken.substring(currentToken.length - 5, currentToken.length - 1);
		prompt += chalk.yellow(` (${front}*****${back})`);
	} else {
		prompt += chalk.yellow(' (required)');
	}
	let user = { firstName: '' };
	const contentfulToken = await password({
		mask: '*',
		message: prompt,
		async validate(val) {
			const token = val.length ? val : currentToken;
			if (token.length === 0) {
				return chalk.yellow('Please enter a valid Token!');
			}
			const client = createClient(token);
			try {
				user = await client.getCurrentUser();
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
			} catch (error) {
				return `${chalk.red('Bad Token!')} Check your token in contentful`;
			}
			return true;
		},
	});

	return {
		token: contentfulToken || currentToken,
		user,
	};
}

/**
 * Prompt user for the space to use in Contentful.  This should list only spaces visible to you.
 *
 * @param {string} - spaceId
 * @param {contentful} - Contentful client
 */
export async function promptSpaceConfig(spaceId: string, client: ClientAPI) {
	const spaces = await client.getSpaces();
	const choices = [];
	const { items } = spaces;
	for (let i = 0, len = items.length; i < len; i += 1) {
		const item = items[i];
		choices.push({ name: item.name, value: item.sys.id });
	}

	const qn = {
		name: 'spaceId',
		type: 'list',
		message: 'Select space to use',
		default: '',
		choices,
	};
	if (spaceId !== undefined && spaceId !== '') {
		qn.default = spaceId;
	}

	return select(qn);
}

/**
 * Prompt user for the space id and environment id.
 *
 * @param {string} spaceId - Prior space id in Contentful
 * @param {string} envId - Prior environment id of the current selection.
 * @param {ContentfulClientApi} cc - Contentful client
 */
export async function promptEnvConfig(spaceId: string, envId: string, cc: ClientAPI) {
	const space = await cc.getSpace(spaceId);
	const envs = await space.getEnvironments();

	const envMap: Record<string, string> = { master: 'master' };
	const { items } = envs;
	for (let i = 0, len = items.length; i < len; i += 1) {
		const item = items[i];
		// remove the aliased master environment, since we have created a default one.
		if (item.sys.id !== 'master') {
			envMap[item.name] = item.sys.id;
		}
	}
	const choices: { name: string; value: string }[] = [];
	Object.entries(envMap).forEach(([key, value]) => {
		choices.push({ name: key, value });
	});
	const qn = {
		type: 'list',
		message: 'Select Environment to use',
		default: '',
		choices,
	};
	let newEnvId = envId;
	if (envId === undefined || envId === '') {
		newEnvId = 'master';
	}
	qn.default = newEnvId;
	return select(qn);
}

/**
 * Find the refernce entry ids in an object.
 * @param {object} entry - Contentful Entry Id
 * @returns {array} - Array of Entry Ids
 */
export function findReferencesInEntry(entry: Entry) {
	const keys = Object.keys(entry.fields);
	const result: { assets: string[]; entries: string[] } = {
		assets: [],
		entries: [],
	};
	keys.forEach((key) => {
		const value = entry.fields[key];
		if (value !== undefined) {
			const englishValue = value['en-US'];
			if (englishValue?.sys?.type === 'Link' && englishValue?.sys?.id) {
				if (englishValue.sys.linkType === 'Entry') {
					result.entries.push(englishValue.sys.id);
				} else if (englishValue.sys.linkType === 'Asset') {
					result.assets.push(englishValue.sys.id);
				}
			} else if (Array.isArray(englishValue)) {
				englishValue.forEach((link) => {
					if (link?.sys?.type === 'Link' && link?.sys?.id) {
						if (link.sys.linkType === 'Entry') {
							result.entries.push(link.sys.id);
						} else if (link.sys.linkType === 'Asset') {
							result.assets.push(link.sys.id);
						}
					}
				});
			}
		}
	});
	return result;
}

/**
 * Find all the linked references in an object and recursively track them.
 *
 * @param {ContentfulClientAPI} cmClient - Contentful Management API
 * @param {string} entryId  - Contentful Entry ID
 *
 * @returns {array} - list of referenced entry ids
 */
export async function findAllLinkedReferences(
	cmClient: Environment,
	entryId: string,
	depth = 0,
	refs: Record<string, boolean> = {},
	excludeContentTypes: string[] = [],
) {
	const entry = await getEntry(cmClient, entryId);
	if (entry) {
		console.log(`${'  '.repeat(depth)}${entryId}[${chalk.blue(entry.sys.contentType.sys.id)}] ${chalk.yellow(getName(entry))}`);
		if (excludeContentTypes.length > 0 && excludeContentTypes.includes(entry.sys.contentType.sys.id)) {
			console.log(`${'  '.repeat(depth)}skipping...`);
			return {
				entries: [],
				assets: [],
			};
		}

		refs[entryId] = true;
		const referenceLinks = findReferencesInEntry(entry);
		const result = {
			entries: [entryId],
			assets: referenceLinks.assets,
		};
		for (const id of referenceLinks.entries) {
			if (refs[id]) {
				continue;
			}
			const referenceResult = await findAllLinkedReferences(cmClient, id, depth + 1, refs, excludeContentTypes);
			result.entries = result.entries.concat(referenceResult.entries);
			result.assets = result.assets.concat(referenceResult.assets);
		}

		return {
			entries: result.entries,
			assets: result.assets,
		};
	}
	return {
		entries: [],
		assets: [],
	};
}

/**
 * Get a Contenful entry with a cached store.  This should be used instead
 * of calling cmClient.getEntry directly.
 *
 * @param {ContentfulClientAPI} cmClient - Contentful Management API
 * @param {string} entryId - Contentful Entry ID
 * @param {boolean} silent - Whether to throw an error if missing an entry id
 * @param {QueryOptions} options - Contentful get entry options
 * @returns contentful entry
 */
const entryCache: Record<string, Entry> = {};
export async function getEntry(cmClient: Environment, entryId: string, silent = false, options: QueryOptions = {}): Promise<Entry | null> {
	// check cache first
	let entry = entryCache[entryId];
	if (entry !== undefined) {
		return entry;
	}

	try {
		entry = await cmClient.getEntry(entryId, options);
		entryCache[entryId] = entry;
		return entry;
	} catch (err) {
		if ((err as Error).name === 'NotFound') {
			if (!silent) {
				console.log(`${chalk.redBright('[ERROR]')} unable to find entry id ${chalk.yellow(entryId)}`);
			}
			// don't throw error. we just print out message and return null so bad references don't stop export
			return null;
		}
		console.log(`${chalk.redBright('[ERROR]')} unable to find entry id ${chalk.yellow(entryId)}`, err);

		return null;
	}
}

/**
 * Get the name of entry or asset
 * @param {Entry|Asset} entryOrAsset
 * @returns {string}
 */
export function getName(entryOrAsset?: Entry | Asset) {
	if (entryOrAsset?.sys.type === 'Entry') {
		const entry = entryOrAsset as Entry;
		if (entry?.fields.internalName) {
			return entry.fields.internalName['en-US'];
		}
		if (entry?.fields.title) {
			return entry.fields.title['en-US'];
		}
		if (entry?.fields.id) {
			return entry.fields.id['en-US'];
		}
	} else {
		const asset = entryOrAsset as Asset;
		if (asset?.fields.title) {
			return asset.fields.title['en-US'];
		}
	}
	return 'unknown name';
}

/**
 * Get the content type AKA model for contentful
 * @param {ContentfulAPI} environment contentful environment api
 * @param {string} contentTypeId optional content id
 * @returns {ContentType[]} array of content types
 */
export async function getContentTypes(environment: Environment, contentTypeId = '') {
	return contentTypeId ? [await environment.getContentType(contentTypeId)] : (await environment.getContentTypes({ limit: 1000 })).items;
}

/**
 * Get fields of a content type
 * @param contentType
 * @param filterFields
 * @returns
 */
export function getFilteredFields(contentType: ContentType | undefined, filterFields: string[] = []) {
	if (!contentType) {
		return [];
	}
	const { fields } = contentType;
	return filterFields.length > 0 ? contentType.fields.filter((f) => filterFields.includes(f.id)) : fields;
}

/**
 * Get contentful entries
 * @param client
 * @param ids
 */
export async function getEntries(client: Environment, ids: string[]) {
	let entries: Entry[] = [];
	const chunkSize = 10;
	for (let i = 0; i < ids.length; i += chunkSize) {
		const chunk = ids.slice(i, i + chunkSize);
		const queryOptions: QueryOptions = { 'sys.id[in]': chunk.join(',') };
		const chunkEntries = await client.getEntries(queryOptions);
		entries = entries.concat(Array.from(chunkEntries.items as Entry[]));
	}
	return entries;
}

/**
 * Open the file using the appropriate application
 * @param {string} filePath
 */
export function openFile(filePath: string) {
	console.log(`Opening ${chalk.blue(filePath)}`);
	if (process.platform === 'darwin') {
		execSync(`open "${filePath}"`);
	} else if (process.platform === 'win32') {
		try {
			execSync(`explorer "${filePath}"`);
		} catch {
			// we don't care about exceptions
		}
	}
}
