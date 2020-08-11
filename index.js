require('dotenv').config();
require('chromedriver');
const { Builder, By, Key, until, Button } = require('selenium-webdriver');
const { openDb } = require('./utils/db');
const fs = require('fs');
const util = require('util');
const readFile = util.promisify(fs.readFile);
const { Webhook, MessageBuilder } = require('discord-webhook-node');
const hook = new Webhook(process.env.DISCORD_WEBHOOK);
const IMAGE_URL =
	'https://www.radarcupao.pt/assets/persist/cache/160x160_logo/persist/images/logos/worten.pt.png';
hook.setUsername('Worten Monitor');
const chrome = require('selenium-webdriver/chrome');
var cron = require('node-cron');
// Sets avatar image for discord webhook
hook.setAvatar(IMAGE_URL);
//Loads items from file items.txt and sends them to be processed
async function loadItemNamesforSearch() {
	console.log('Checking!');
	let filename = 'items.txt';
	await readFile(filename, 'utf8', async function (err, data) {
		if (err) throw err;
		await startTracking(await data.split('\r\n'));
		console.log('done!');
	});
}
//Creates the browser instance at TARGET_WEBSITE
async function setup(itemName) {
	let driver = await new Builder()
		.forBrowser('chrome')
		.setChromeOptions(new chrome.Options().headless())
		.build();
	let url =
		process.env.TARGET_WEBSITE +
		'search?query=' +
		itemName +
		'&sortBy=relevance&hitsPerPage=48&page=1&facetFilters=seller_id%3A689dda97-efa4-4c6d-96bc-6f4bbfda8394&latestFacet=seller_id%3A689dda97-efa4-4c6d-96bc-6f4bbfda8394';
	await driver.get(url);
	await driver.wait(until.elementLocated(By.id('products-list-block')));
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
	// Loop goes over every single item on the list
	let procedItemNames = await itemNames.map(async (itemName) => {
		const driver = await setup(encodeURIComponent(itemName));

		let products = await driver.findElements(By.className('w-product__url'));
		let db = await openDb();
		//Goes over every single product on page
		let processedProducts = await products.map(async (product) => {
			try {
				let productName = await product
					.findElement(By.className('w-product__title'))
					.getText();
				let price = await product
					.findElement(By.className('w-currentPrice iss-current-price'))
					.getText();
				let link = await product.getAttribute('href');
				let image = await product
					.findElement(By.css('figure > img'))
					.getAttribute('src');
				const row = await db.get('SELECT * FROM products WHERE name = :name', {
					':name': productName,
				});
				//console.log(productName + ' Price: ' + price);
				price = price.replace(/€/, '');
				price = price.replace(/,/, '.');
				price = price.trim();
				if (row == undefined) {
					let res = await db.run(
						'INSERT INTO products (name,price) VALUES (?,?)',
						productName,
						price
					);
					let embed = await new MessageBuilder()
						.setTitle('NEW PRICE')
						.setURL(link)
						.addField('Price', price + '€', true)
						.setColor('#e41a15')
						.setThumbnail(image)
						.setDescription(productName)
						.setTimestamp();

					await hook.send(embed);
				} else {
					if (price != row.price) {
						res = db.run(
							'UPDATE products set price = ? WHERE id=?',
							price,
							row.id
						);
						let priceDifference = price - row.price;
						let embed = await new MessageBuilder()
							.setTitle('NEW PRICE')
							.setURL(link)
							.addField('Price', price + '€', true)
							.addField('Difference', priceDifference + '€', true)
							.setColor('#e41a15')
							.setThumbnail(image)
							.setDescription(productName)
							.setTimestamp();

						await hook.send(embed);
					}
				}
			} catch (error) {
				console.log(error);
			}
		});

		await Promise.all(processedProducts);
		await driver.close();
	});
	await Promise.all(procedItemNames);
}
async function main() {
	loadItemNamesforSearch();
	cron.schedule('* * * * *', () => {
		loadItemNamesforSearch();
	});
}
main();
