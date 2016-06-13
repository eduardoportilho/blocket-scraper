var express = require('express');
var fs = require('fs');
var request = require('request');
var app     = express();
var cheerio = require('cheerio')

app.get('/getlinks', function(req, res){

  //All the web scraping magic will happen here
	url = 'https://www.blocket.se/hela_sverige?q=&cg=1020&w=1&st=s&ps=&pe=6&mys=2005&mye=2016&ms=&me=&cxpf=&cxpt=&fu=&gb=&ca=11&is=1&l=0&md=th&cp=';

    request(url, function(error, response, html){
		if (error) {
			console.log("Couldn’t get page because of error: " + error);
			return;
		}
		var $ = cheerio.load(html),
			links = $('#item_list > .item_row a.item_link');
			//.map(function(i, link) {
			// 	return $(link).attr("href");
			// });


		var urls = [];
		links.each(function (i, link) {
			urls.push($(link).attr("href"));
		});

		console.log(urls);
		res.send({result: urls});
    });
});


app.listen('8081')
console.log('Magic happens on port 8081');
exports = module.exports = app;