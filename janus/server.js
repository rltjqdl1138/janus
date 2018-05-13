const https = require('https')
const fs = require('fs')
const url = require('url')

var option = {
    key:    fs.readFileSync('./key.pem'),
    cert:   fs.readFileSync('./cert.pem')
}

//https.createServer ( (req, res) =>{
https.createServer ( option, (req, res) =>{
    console.log("hehe")
    var pathname = url.parse(req.url).pathname;
    if(pathname == "/")
        pathname = "/viewer.html"
    fs.readFile(pathname.substr(1), function (err, data) {
        if (err) {
            console.log(err);
            res.writeHead(404, {'Content-Type': 'text/html'});
            }else{
            res.writeHead(200, {'Content-Type': 'text/html'});	
               
            res.write(data.toString());		
        }
        res.end();
    })
}).listen(4001)


console.log('Server running at https://127.0.0.1:6000')
