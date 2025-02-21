import { describe, expect, test } from 'vitest';
import { createClient } from './contentful.js';

describe('createClient', () => {
	test('should create client', async () => {
		const client = createClient('token-1234');
		expect(client).not.toBeNull();
	});
});
