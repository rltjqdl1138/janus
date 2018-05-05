const express = require('express');
const router = express.Router();
var Rooms = require('../models/rooms')
var Media = require('../models/media')

router.post('/media/event', (req, res)=>{
	Media.event({janus:"event", sender:Media.session,"plugindata":{data:req.body}}, 200)
	res.end();
})
router.post('/media/list', (req, res)=>{
	console.log(">>list<<")
	for(var l in Rooms){
		console.log(l+": "+Rooms[l])
	}
	res.end()
})

module.exports = router