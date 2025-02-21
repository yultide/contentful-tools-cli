import { CommonNode, Next, Options, RenderMark, RenderNode } from '@contentful/rich-text-html-renderer';
import { Block, BLOCKS, Document, helpers, Inline, INLINES, Mark, MARKS, TableRow } from '@contentful/rich-text-types';

/**
 * Convert richtext JSON structure to markdown for easier translation
 * @param {Document} doc
 * @return {string} markdown text
 */
export function richTextToMarkdown(richText: Document) {
	let inOL = false;
	let olCount = 1;
	// let inUL = false;
	let inTable = false;
	let inTableHeader = false;
	let tableColumnCount = 0;

	const options = {
		renderNode: {
			[BLOCKS.DOCUMENT]: (node: Block | Inline, next: Next) => `${next(node.content)}\n`,
			[BLOCKS.PARAGRAPH]: (node: Block | Inline, next: Next) => (inTable ? `${next(node.content)}<br/>` : `${next(node.content)}\n\n`),
			[BLOCKS.HEADING_1]: (node: Block | Inline, next: Next) => `# ${next(node.content)}\n`,
			[BLOCKS.HEADING_2]: (node: Block | Inline, next: Next) => `## ${next(node.content)}\n`,
			[BLOCKS.HEADING_3]: (node: Block | Inline, next: Next) => `### ${next(node.content)}\n`,
			[BLOCKS.HEADING_4]: (node: Block | Inline, next: Next) => `#### ${next(node.content)}\n`,
			[BLOCKS.HEADING_5]: (node: Block | Inline, next: Next) => `##### ${next(node.content)}\n`,
			[BLOCKS.HEADING_6]: (node: Block | Inline, next: Next) => `###### ${next(node.content)}\n`,
			[BLOCKS.OL_LIST]: (node: Block | Inline, next: Next) => {
				inOL = true;
				olCount = 1;
				const result = `${next(node.content)}\n`;
				inOL = false;
				return result;
			},
			[BLOCKS.UL_LIST]: (node: Block | Inline, next: Next) => {
				// inUL = true;
				const result = `${next(node.content)}\n`;
				// inUL = false;
				return result;
			},
			[BLOCKS.LIST_ITEM]: (node: Block | Inline, next: Next) => {
				const result = `${inOL ? `${olCount}.` : ' *'} ${next(node.content)}`;
				olCount += 1;
				return result;
			},
			[BLOCKS.HR]: (/* node: Block | Inline, next: Next */) => `----------\n`,
			// [BLOCKS.QUOTE]: (node: Block | Inline, next: Next) => `> ${next(node.content).replace('\n', '\n> ')}\n`,
			[BLOCKS.QUOTE]: (node: Block | Inline, next: Next) => {
				const out = next(node.content);
				const result = out
					.split(/\n/g)
					.map((l) => `> ${l}`)
					.join('\n');
				return `${result}\n`;
			},
			[BLOCKS.EMBEDDED_ENTRY]: (node: Block | Inline) => `![embedded-entry-block](${node.data.target.sys.id})`,
			[BLOCKS.EMBEDDED_ASSET]: (node: Block | Inline) => `![embedded-asset-block](${node.data.target.sys.id})`,
			[BLOCKS.TABLE]: (node: Block | Inline, next: Next) => {
				inTable = true;
				const tableRows = node.content as TableRow[];
				tableColumnCount = tableRows[0].content.length;
				inTableHeader = true;
				const tableHeader = next([tableRows[0] as CommonNode]);
				inTableHeader = false;
				const result = [
					`${tableHeader}`,
					`|${Array.from(Array(tableColumnCount).keys())
						.map(() => '--|')
						.join('')}\n`,
					`${next(tableRows.slice(1) as CommonNode[])}`,
				].join('');
				inTable = false;
				return `${result}\n`;
			},
			[BLOCKS.TABLE_ROW]: (node: Block | Inline, next: Next) => `| ${next(node.content)}\n`,
			[BLOCKS.TABLE_CELL]: (node: Block | Inline, next: Next) => ` ${next(node.content).replace(/\n/g, inTableHeader ? '' : '<br/>')} |`,
			[BLOCKS.TABLE_HEADER_CELL]: (node: Block | Inline, next: Next) => ` ${next(node.content).replace(/\n/g, inTableHeader ? '' : '<br/>')} |`,
		},
		renderMark: {
			[MARKS.BOLD]: (text: string) => (text.trim() ? `**${text.trim()}**` : ''),
			[MARKS.ITALIC]: (text: string) => (text.trim() ? `_${text.trim()}_` : ''),
			[MARKS.UNDERLINE]: (text: string) => `<u>${text.trim()}</u>`,
			[MARKS.CODE]: (text: string) => `\`${text}\``,
			[MARKS.SUPERSCRIPT]: (text: string) => `<sup>${text.trim()}</sup>`,
			[MARKS.SUBSCRIPT]: (text: string) => `<sub>${text.trim()}</sub>`,
		},
	};

	const result = contentfulRichTextRenderer(richText, options);
	return result;
}

// from: https://github.com/contentful/rich-text/blob/master/packages/rich-text-html-renderer/src/index.ts
// we pull in the implementation to remove html escaping when rendering.

const attributeValue = (value: string) => `"${value.replace(/"/g, '&quot;')}"`;

const defaultInline = (type: string, node: Inline) => `<span>type: ${encodeURIComponent(type)} id: ${encodeURIComponent(node.data.target.sys.id)}</span>`;

const defaultNodeRenderers: RenderNode = {
	[BLOCKS.PARAGRAPH]: (node, next) => `<p>${next(node.content)}</p>`,
	[BLOCKS.HEADING_1]: (node, next) => `<h1>${next(node.content)}</h1>`,
	[BLOCKS.HEADING_2]: (node, next) => `<h2>${next(node.content)}</h2>`,
	[BLOCKS.HEADING_3]: (node, next) => `<h3>${next(node.content)}</h3>`,
	[BLOCKS.HEADING_4]: (node, next) => `<h4>${next(node.content)}</h4>`,
	[BLOCKS.HEADING_5]: (node, next) => `<h5>${next(node.content)}</h5>`,
	[BLOCKS.HEADING_6]: (node, next) => `<h6>${next(node.content)}</h6>`,
	[BLOCKS.EMBEDDED_ENTRY]: (node, next) => `<div>${next(node.content)}</div>`,
	[BLOCKS.UL_LIST]: (node, next) => `<ul>${next(node.content)}</ul>`,
	[BLOCKS.OL_LIST]: (node, next) => `<ol>${next(node.content)}</ol>`,
	[BLOCKS.LIST_ITEM]: (node, next) => `<li>${next(node.content)}</li>`,
	[BLOCKS.QUOTE]: (node, next) => `<blockquote>${next(node.content)}</blockquote>`,
	[BLOCKS.HR]: () => '<hr/>',
	[BLOCKS.TABLE]: (node, next) => `<table>${next(node.content)}</table>`,
	[BLOCKS.TABLE_ROW]: (node, next) => `<tr>${next(node.content)}</tr>`,
	[BLOCKS.TABLE_HEADER_CELL]: (node, next) => `<th>${next(node.content)}</th>`,
	[BLOCKS.TABLE_CELL]: (node, next) => `<td>${next(node.content)}</td>`,
	[INLINES.ASSET_HYPERLINK]: (node) => defaultInline(INLINES.ASSET_HYPERLINK, node as Inline),
	[INLINES.ENTRY_HYPERLINK]: (node) => defaultInline(INLINES.ENTRY_HYPERLINK, node as Inline),
	[INLINES.EMBEDDED_ENTRY]: (node) => defaultInline(INLINES.EMBEDDED_ENTRY, node as Inline),
	[INLINES.HYPERLINK]: (node, next) => {
		const href = typeof node.data.uri === 'string' ? node.data.uri : '';
		return `<a href=${attributeValue(href)}>${next(node.content)}</a>`;
	},
};

const defaultMarkRenderers: RenderMark = {
	[MARKS.BOLD]: (text) => `<b>${text}</b>`,
	[MARKS.ITALIC]: (text) => `<i>${text}</i>`,
	[MARKS.UNDERLINE]: (text) => `<u>${text}</u>`,
	[MARKS.CODE]: (text) => `<code>${text}</code>`,
	[MARKS.SUPERSCRIPT]: (text) => `<sup>${text}</sup>`,
	[MARKS.SUBSCRIPT]: (text) => `<sub>${text}</sub>`,
};

/**
 * Serialize a Contentful Rich Text `document` to an html string.
 */
export function contentfulRichTextRenderer(richTextDocument: Document, options: Partial<Options> = {}): string {
	if (!richTextDocument || !richTextDocument.content) {
		return '';
	}

	return nodeListToHtmlString(richTextDocument.content, {
		renderNode: {
			...defaultNodeRenderers,
			...options.renderNode,
		},
		renderMark: {
			...defaultMarkRenderers,
			...options.renderMark,
		},
	});
}

function nodeListToHtmlString(nodes: CommonNode[], { renderNode, renderMark }: Options): string {
	return nodes.map<string>((node) => nodeToHtmlString(node, { renderNode, renderMark })).join('');
}

function nodeToHtmlString(node: CommonNode, { renderNode = {}, renderMark = {} }: Options): string {
	if (helpers.isText(node)) {
		// don't escape
		// const nodeValue = escape(node.value);

		const nodeValue = node.value;
		if (node.marks.length > 0) {
			return node.marks.reduce((value: string, mark: Mark) => {
				if (!renderMark[mark.type]) {
					return value;
				}
				return renderMark[mark.type](value);
			}, nodeValue);
		}

		return nodeValue;
	}
	const nextNode: Next = (nodes) => nodeListToHtmlString(nodes, { renderMark, renderNode });
	if (!node.nodeType || !renderNode[node.nodeType]) {
		// TODO: Figure what to return when passed an unrecognized node.
		return '';
	}
	return renderNode[node.nodeType](node, nextNode);
}
