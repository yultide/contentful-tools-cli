import chalk from 'chalk';
import { afterAll, afterEach, describe, expect, test } from 'vitest';
import { mockConsole } from 'vitest-console';
import { logger } from './logger.js';

describe('renderTitle', () => {
	const { clearConsole, restoreConsole } = mockConsole({ quiet: true });
	afterEach(clearConsole);
	afterAll(restoreConsole);

	test('should log info', () => {
		logger.info('info');
		expect(console).toHaveLoggedTimes(1);
		expect(console).toHaveLoggedWith(chalk.cyan('info'));
	});

	test('should log warn', () => {
		logger.warn('warn');
		expect(console).toHaveLoggedTimes(1);
		expect(console).toHaveLoggedWith(chalk.yellow('warn'));
	});

	test('should log succeed', () => {
		logger.succeed('succeed');
		expect(console).toHaveLoggedTimes(1);
		expect(console).toHaveLoggedWith(chalk.green('succeed'));
	});

	test('should log error', () => {
		logger.error('error');
		expect(console).toHaveLoggedTimes(1);
		expect(console).toHaveLoggedWith(chalk.red('error'));
	});
});
