const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function openDb() {
	return open({
		filename: 'pricing.db',
		driver: sqlite3.Database,
	});
}
exports.openDb = openDb;
