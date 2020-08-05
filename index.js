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
hook.setAvatar(IMAGE_URL);

async function loadItemNamesforSearch() {
	let filename = 'items.txt';
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
		const driver = await setup(encodeURIComponent(itemName));
		let products = await driver.findElements(By.className('w-product__url'));
		await driver.wait(
			until.elementLocated(By.xpath('//img[@class="lazy loaded"]'))
		);
		let db = await openDb();
		products.forEach(async (product) => {
			try {
				let productName = await product
					.findElement(By.className('w-product__title'))
					.getText();
				let price = await product
					.findElement(By.className('w-currentPrice iss-current-price'))
					.getText();
				let link = await product.getAttribute('href');
				let image = await product
					.findElement(By.tagName('img'))
					.getAttribute('src');
				const row = await db.get('SELECT * FROM products WHERE name = :name', {
					':name': productName,
				});

				price = price.replace(/€/, '');
				price = price.replace(/,/, '.');
				price = price.trim();
				let embed = new MessageBuilder()
					.setTitle('NEW PRICE')
					.setURL(link)
					.addField('Price', price, true)
					.setColor('#e41a15')
					.setThumbnail(image)
					.setDescription(productName)
					.setTimestamp();

				hook.send(embed);
				if (row == undefined) {
					let res = await db.run(
						'INSERT INTO products (name,price) VALUES (?,?)',
						productName,
						price
					);
					embed = new MessageBuilder()
						.setTitle('NEW PRICE')
						.setURL(link)
						.addField('Price', price, true)
						.setColor('#e41a15')
						.setThumbnail(image)
						.setDescription(productName)
						.setTimestamp();

					hook.send(embed);
				} else {
					if (price != row.price) {
						res = db.run(
							'UPDATE products set price = ? WHERE id=?',
							price,
							row.id
						);
						embed = new MessageBuilder()
							.setTitle('NEW PRICE')
							.setURL(link)
							.addField('Price', price, true)
							.setColor('#e41a15')
							.setThumbnail(image)
							.setDescription(productName)
							.setTimestamp();

						hook.send(embed);
					}
				}
			} catch (error) {
				console.log(error);
			}
		});
		driver.close();
	});
}
loadItemNamesforSearch();
