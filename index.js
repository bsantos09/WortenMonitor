const puppeteer = require('puppeteer');
require('dotenv').config();
require('chromedriver');
const { Builder, By, Key, until, Button } = require('selenium-webdriver');

const fs = require('fs');
const util = require('util');
const readFile = util.promisify(fs.readFile);

async function loadItemNamesforSearch() {
	let filename = 'items.txt';
	let items;
	await readFile(filename, 'utf8', async function (err, data) {
		if (err) throw err;
		startTracking(data.split('\r\n'));
		console.log('DATA');
	});
}
async function setup(itemName) {
	let driver = await new Builder().forBrowser('chrome').build();
	console.log(process.env.TARGET_WEBSITE);
	let url =
		process.env.TARGET_WEBSITE +
		'search?query=' +
		itemName +
		'&sortBy=relevance&hitsPerPage=48&page=1&facetFilters=seller_id%3A689dda97-efa4-4c6d-96bc-6f4bbfda8394&latestFacet=seller_id%3A689dda97-efa4-4c6d-96bc-6f4bbfda8394';
	await driver.get(url);
	await driver.wait(
		until.elementLocated(
			By.xpath('/html/body/div[1]/section/div[2]/div[2]/button')
		)
	);
	await driver
		.findElement(By.xpath('/html/body/div[1]/section/div[2]/div[2]/button'))
		.click();
	return driver;
}

async function startTracking(itemNames) {
	console.log(itemNames);
	await itemNames.forEach(async (itemName) => {
		let driver = await setup(encodeURIComponent(itemName));
		let products = await driver.findElements(By.className('w-product__url'));
		products.forEach(async (product) => {
			let productName = await product
				.findElement(By.className('w-product__title'))
				.getText();
			let price = await product
				.findElement(By.className('w-currentPrice iss-current-price'))
				.getText();

			console.log('Name: ' + productName + ' Price: ' + price);
		});
	});
}
loadItemNamesforSearch();
