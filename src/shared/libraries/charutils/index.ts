export function charAt(str: string, index: number) {
	return str.sub(index, index);
}

/**
 * Converts a string to an array of byte values (0-255)
 * @param str The input string to convert
 * @returns An array of byte values
 */
function stringToByteArray(str: string): number[] {
	const byteArray: number[] = [];

	// Iterate through each character in the string
	for (let i = 1; i <= str.size(); i++) {
		// Get the Unicode value of the character and convert to byte
		const [charCode] = string.byte(str, i);

		// Ensure the byte is within 0-255 range
		byteArray.push(charCode);
	}

	return byteArray;
}