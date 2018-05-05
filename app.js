const http = require('http')
const api = require('./routes')
var express = require('express')
var app = express();
var bodyParser = require('body-parser');
const router = express.Router();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
const port = 5000
const server = http.Server(app);


app.use('/api', api);
server.listen(port, function() {
	console.log("Express server has started on port " + port)
});
