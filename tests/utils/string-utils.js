export const bigString = (size = 5000) => 'x'.repeat(size);

export const toString = (buf) => Buffer.isBuffer(buf) ? buf.toString() : String(buf);