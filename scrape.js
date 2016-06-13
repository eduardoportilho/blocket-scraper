var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');

var baseUrl = 'https://www.blocket.se/hela_sverige'
var firstPageQuery = '?q=&cg=1020&w=1&st=s&ps=&pe=6&mys=2005&mye=2016&ms=&me=&cxpf=&cxpt=&fu=&gb=&ca=11&is=1&l=0&md=th&cp=';

//para testes
var breakOnFirstListPage = false;
var breakOnFirstAd = false

var links = [];
var linkProcessorQueue = [];
var anunciosLidos = [];

//le tudo
// breakOnFirstListPage = true;
// breakOnFirstAd = true;
readListPage(firstPageQuery, processListPage);


//le um anuncio
//var ad = 'https://www.blocket.se/stockholm/VW_Caddy_1_9_TDI__lagmil__Dragkrok_nybes_67469905.htm?ca=11&w=1';
//ad = 'https://www.blocket.se/stockholm/Nybesiktad_volvo_v70_67469819.htm?ca=11&w=1';
//ad = 'https://www.blocket.se/stockholm/Audi_A6_2_0T_66815848.htm?ca=11&w=1';
//readAdPage(ad, function(anuncio) {
//	console.log(anuncio);
//});



//Guarda o resultado do scrape e repete para a próxima pagina, se houve
var _pageNum = 1;
function processListPage(page) {
	console.log("Page " + (_pageNum++) + ' scraped, got '+ page.links.length +' links, next page:' + page.nextPageQuery);
	links = links.concat(page.links);
	if(!breakOnFirstListPage && page.nextPageQuery !== undefined) {
		readListPage(page.nextPageQuery, processListPage)
	} else {
		processFetchedLinks(links);
	}
}

function processFetchedLinks(fetchedLinks) {
	linkProcessorQueue = fetchedLinks.slice(0);
	if(breakOnFirstAd) {
		linkProcessorQueue = fetchedLinks.slice(0, 1);
	}
	fs.writeFileSync('links.csv', linkProcessorQueue.join('\n'));

	spawnLinkProcessorWorker(finishProcessingFetchedLinks);
}


function finishProcessingFetchedLinks() {
	processAnuncios(anunciosLidos);
}

function spawnLinkProcessorWorker(allWorkDone) {
	console.log('worker: ' + linkProcessorQueue.length + ' remaining');
	if(linkProcessorQueue.length <= 0) {
		console.log("No more work to do! :)");
		allWorkDone();
		return;
	}
	var url = linkProcessorQueue.shift();
	readAdPage(url, function(anuncio) {
		anunciosLidos.push(anuncio);
		spawnLinkProcessorWorker(allWorkDone);
	});
}

function readListPage(query, done) {
	var result = {
		links: [],
		nextPageQuery: undefined
	};
	var url = baseUrl+query;

	//console.log('Will scrape [' + url + ']');
	request(url, function(error, response, html) {
		if (error) {
			console.log("Couldn’t get page because of error: " + error);
			return;
		}
		var $ = cheerio.load(html),
			links = $('#item_list > .item_row a.item_link'),
			navigation = $('#all_pages a.page_nav');

		links.each(function (i, link) {
			result.links.push($(link).attr("href"));
		});

		navigation.each(function (i, link) {
			if($(link).text().indexOf('Nästa sida') >= 0) {
				result.nextPageQuery = $(link).attr("href");
			}
		});
		done(result);
	});
}

function readAdPage(adUrl, whenDone) {
	if(!isurl(adUrl)) {
		console.log("Invalid URL: " + adUrl);
		whenDone();
		return;
	}
	console.log("Will read ad page: " + adUrl);
	request(adUrl, function(error, response, html) {
		if (error) {
			console.log("Couldn’t get page because of error: " + error);
			whenDone();
			return;
		}
		var $ = cheerio.load(html),
			anuncio = parseAnuncio(adUrl, $);
		whenDone(anuncio);
	});
}

function parseAnuncio(adUrl, $) {
	var anuncio = {
		link: adUrl,
		titulo: null,
		preco: null,
		dtAnuncio: null,
		ano: null,
		km: null,
		gas: null,
		cambio: null,
		local: null,
		linkMapa: null,
		marca: null,
		modelo: null,
		tipo: null,
		cor: null
	};

	anuncio.titulo = tx($('#blocket_content h1.h3').text());
	anuncio.preco = nm($('#vi_price').text());
	anuncio.dtAnuncio = $('#seller-info time').attr('datetime');

	var itemDetails = parseItemDetails($);
	// $('#item_details dd')
	// 	.map(function() {return $(this).text();});
	anuncio.ano = parseAno(itemDetails);
	anuncio.km = parseKm(itemDetails);
	anuncio.gas = tx(itemDetails['Bränsle']);
	anuncio.cambio = tx(itemDetails['Växellåda']);
	anuncio.local = tx($('#ad_location .area_label').text()).replace(/[\(\)]/g, '');
	anuncio.linkMapa = $('#ad_location a.show_on_map_label').attr("href");

	var extraDetails = parseExtraDetails($);
	anuncio.marca = extraDetails['Märke'];
	anuncio.modelo = extraDetails['Modell'];
	anuncio.tipo = extraDetails['Biltyp'];
	anuncio.cor = extraDetails['Färg'];

	return anuncio;
}

function parseAno(itemDetails) {
	var ano1 = parseInt(itemDetails['Modellår'].trim()) || 9999,
		ano2 = parseInt(itemDetails['Tillverkningsår'].trim()) || 9999;
	return Math.min(ano1, ano2);
}
function parseKm(itemDetails) {
	var kms = itemDetails['Miltal'].replace(/\s/g, '').split('-');
	return Math.max.apply(null, kms);
}
function parseItemDetails($) {
	var itemDetails = {};
	$('#item_details dl').each(function() {
		var k = tx($(this).find('dt').text()).replace(/\:/, '');
		var v = tx($(this).find('dd').text());
		itemDetails[k] = v;
	});
	return itemDetails;
}
function parseExtraDetails($) {
	var extraDetails = {};
	$('#blocket_content .car_extradata_details li').each(function() {
		var kv = $(this).text().split(':');
		extraDetails[kv[0].trim()] = kv[1].trim();
	});
	return extraDetails;
}
function tx(str) {
	return str.replace(/\s+/g, ' ').trim();
}
function nm(str) {
	return str.replace(/[^0-9\.\,]/g, '');
}
function isurl(str) {
	return typeof str === 'string' &&
			str.length > 0 &&
			str.indexOf('http' === 0);
}

function processAnuncios(anuncios) {
	var file = fs.createWriteStream('result.txt'),
		keys = Object.keys(anuncios[0]);
	file.write(keys.join(';') + '\n');

	anuncios.forEach(function(anuncio) {
		var vals = keys.map(function(k){
			return anuncio[k];
		});
		file.write(vals.join(';') + '\n'); 
	});
	file.end();
}


