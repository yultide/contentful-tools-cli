module.exports = {
	bracketSameLine: false,
	printWidth: 160,
	semi: true,
	singleQuote: true,
	tabWidth: 2,
	trailingComma: 'all',
	useTabs: true,
	/**
	 * A workaround for pnpm. If you are using yarn or npm, you can remove this line.
	 */
	plugins: [require.resolve('@trivago/prettier-plugin-sort-imports')],
	importOrderSeparation: false,
	importOrderSortSpecifiers: true,
	importOrderCaseInsensitive: true,
	importOrder: ['^helpers/(.*)$', '^utils/(.*)$', '^types/(.*)$', '^[./]'],
};
