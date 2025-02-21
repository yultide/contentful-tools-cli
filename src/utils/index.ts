/**
 * Check if value is not empty
 * @param {TValue|null|undefined} value value to check if null
 * @returns {boolean} true or false
 */
export function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
	return value !== null && value !== undefined;
}
