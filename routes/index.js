const express = require('express');
const router = express.Router();
var Rooms = require('../models/rooms')
var Media = require('../models/media')

router.post('/media/event', (req, res)=>{
	Media.event({janus:"event", sender:Media.session,"plugindata":{data:req.body}}, 200)
	res.end();
})
router.post('/media/list', (req, res)=>{
	var result = {};
	console.log(">>list<<")
	for(var l in Rooms){
		result[l] = {"Room":Rooms[l]}
	}
	res.json(result)
})

module.exports = router