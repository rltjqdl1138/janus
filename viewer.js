/*
 * @File	viewer.js
 * @Brief	JS code for viewer html
 * @Author	KKS
 * @Copyright Dotout Inc
 *			Release under the GNU General Public License v3
 * todo
 */

 
var server = "https://125.133.241.232:8089/janus";
var username = "kks";
//var myroom = 1234;
var id=0
var getbit = 0;


var janus = null;
var sfutest = null;
var opaqueId = "videoroomtest-"+Janus.randomString(12);
var myusername = null;
var myid = null;
var mystream = null;
// We use this other ID just to map our subscriptions to us
var mypvtid;
var feeds = []
var bitrateTimer = [];

// A new feed has been published, create a new plugin handle and attach to it as a listener
var remoteFeed = null;
function startJanus( myroom ){
	Janus.init({debug: "all", callback: function() {
		
		janus = new Janus(
			{
				server: server,
				success: function() {
				janus.attach(
					{
						plugin: "janus.plugin.videoroom",
						opaqueId: opaqueId,
						success: function(pluginHandle) {
							remoteFeed = pluginHandle;
							remoteFeed.simulcastStarted = false;
							Janus.log("Plugin attached! (" + remoteFeed.getPlugin() + ", id=" + remoteFeed.getId() + ")");
							Janus.log("  -- This is a subscriber");

							var reg = { "request": "listparticipants", "room" : myroom }
							remoteFeed.send({"message": reg, "success":(data)=>{
								if(data !== undefined && data.participants[0] !== undefined && data.participants[0].id !==undefined){
									id=data.participants[0].id
									var listen = { "request": "join", "room": myroom, "ptype": "subscriber", "feed": data.participants[0].id, "private_id": mypvtid };
									remoteFeed.send({"message": listen});
								}
								else{
									id = 0
									var listen = { "request": "join", "room": myroom, "ptype": "subscriber", "feed": 0, "private_id": mypvtid };
									remoteFeed.send({"message": listen});
								}
						}});
						},
						error: function(error) {
							Janus.error("  -- Error attaching plugin...", error);
						},
						onmessage: function(msg, jsep) {
							Janus.debug(" ::: Got a message (listener) :::");
							Janus.debug(msg);
							var event = msg["videoroom"];
							Janus.debug("Event: " + event);
							if(msg["error"] !== undefined && msg["error"] !== null) {
								//feed가 없을 때, (방송이 끊겼을 때 에러 처리)
								if(msg["error_code"]==428){
									setTimeout(function() {
										var register = { "request": "listparticipants", "room" : myroom }
										remoteFeed.send({"message": register, "success":(data)=>{
											if(data !== undefined && data.participants[0] !== undefined && data.participants[0].id !==undefined){
												var listen = { "request": "join", "room": myroom, "ptype": "subscriber", "feed": data.participants[0].id, "private_id": mypvtid };
												remoteFeed.send({"message": listen});
											}
												else{var listen = { "request": "join", "room": myroom, "ptype": "subscriber", "feed": 0, "private_id": mypvtid };
												remoteFeed.send({"message": listen});
											}
										}});
									}, 3000);
									
								}
								else{
									Janus.error(msg["error"]);
								}
							} else if(event != undefined && event != null) {
								if(event === "attached") {
									if(feeds[1] === undefined || feeds[1] === null) {
										feeds[1] = remoteFeed;
									}
									remoteFeed.rfid = msg["id"];
									if(remoteFeed.spinner === undefined || remoteFeed.spinner === null) {
										var target = document.getElementById('viewer');
										remoteFeed.spinner = new Spinner({top:100}).spin(target);
									} else {
										remoteFeed.spinner.spin();
									}
									Janus.log("Successfully attached to feed " + remoteFeed.rfid + " in room " + msg["room"]);

								} else if(event === "event") {
									// Check if we got an event on a simulcast-related event from this publisher
									var substream = msg["substream"];
									var temporal = msg["temporal"];
									if((substream !== null && substream !== undefined) || (temporal !== null && temporal !== undefined)) {
										if(!remoteFeed.simulcastStarted) {
											remoteFeed.simulcastStarted = true;
											// Add some new buttons
										}
										// We just received notice that there's been a switch, update the buttons
									}
								} else {
									// What has just happened?
									
								}
							}
							if(jsep !== undefined && jsep !== null) {
								Janus.debug("Handling SDP as well...");
								Janus.debug(jsep);
								// Answer and attach
								remoteFeed.createAnswer(
									{
										jsep: jsep,
										// Add data:true here if you want to subscribe to datachannels as well
										// (obviously only works if the publisher offered them in the first place)
										media: { audioSend: false, videoSend: false },	// We want recvonly audio/video
										success: function(jsep) {
											Janus.debug("Got SDP!");
											Janus.debug(jsep);
											var body = { "request": "start", "room": myroom };
											remoteFeed.send({"message": body, "jsep": jsep});
										},
										error: function(error) {
											Janus.error("WebRTC error:", error);
											bootbox.alert("WebRTC error... " + JSON.stringify(error));
										}
									});
							}
						},
						webrtcState: function(on) {
							Janus.log("Janus says this WebRTC PeerConnection (feed #" + remoteFeed.rfindex + ") is " + (on ? "up" : "down") + " now");
						},
						onlocalstream: function(stream) {
							// The subscriber stream is recvonly, we don't expect anything here
						},
						onremotestream: function(stream) {
								addButtons = true;
								$("#viewer").bind("playing", function () {
									if(remoteFeed.spinner !== undefined && remoteFeed.spinner !== null)
										remoteFeed.spinner.stop();
									remoteFeed.spinner = null;
								});
							//}
							Janus.attachMediaStream($('#viewer').get(0), stream);
							var videoTracks = stream.getVideoTracks();
							if(videoTracks === null || videoTracks === undefined || videoTracks.length === 0) {
								// No remote video
							
							} else {

							}
							if(!addButtons)
								return;
							if(Janus.webRTCAdapter.browserDetails.browser === "chrome" || Janus.webRTCAdapter.browserDetails.browser === "firefox" ||
									Janus.webRTCAdapter.browserDetails.browser === "safari") {
								bitrateTimer[remoteFeed.rfindex] = setInterval(function() {
									// Display updated bitrate, if supported
									var bitrate = remoteFeed.getBitrate();
									if(bitrate === 0){
										if(getbit < 10)
											getbit += 1;
										else{
											Janus.log("bitrate 0")
											getbit = 0;
											id = 0;
											janus.destroy()
											startJanus(myroom)
										}
									}
									else{
										getbit = 0;
									}
									
								}, 1000);
							}
						},
						oncleanup: function() {
							Janus.log(" ::: Got a cleanup notification (remote feed " + id + ") :::");
							if(remoteFeed.spinner !== undefined && remoteFeed.spinner !== null)
								remoteFeed.spinner.stop();
							remoteFeed.spinner = null;
							if(bitrateTimer[remoteFeed.rfindex] !== null && bitrateTimer[remoteFeed.rfindex] !== null) 
								clearInterval(bitrateTimer[remoteFeed.rfindex]);
							bitrateTimer[remoteFeed.rfindex] = null;
							remoteFeed.simulcastStarted = false;
						}
					});
				},
				error: function(error) {
					Janus.error(error);
				},
				destroyed: function() {
					//window.location.reload();
				}
			});
		}});
}
startJanus(1234)
/*
Janus.init({debug: "all", callback: function() {
	janus = new Janus(
	{
		server: server,
		success: function() {
			janus.attach(
				{
					plugin: "janus.plugin.videoroom",
					opaqueId: opaqueId,
					success: function(pluginHandle) {
						remoteFeed = pluginHandle;
						remoteFeed.simulcastStarted = false;
						Janus.log("Plugin attached! (" + remoteFeed.getPlugin() + ", id=" + remoteFeed.getId() + ")");
						Janus.log("  -- This is a subscriber");
						// We wait for the plugin to send us an offer

						var listen = { "request": "join", "room": myroom, "ptype": "subscriber", "feed": id, "private_id": mypvtid, "pin": "asdf" };
						// In case you don't want to receive audio, video or data, even if the
						// publisher is sending them, set the 'offer_audio', 'offer_video' or
						// 'offer_data' properties to false (they're true by default), e.g.:
						// 		listen["offer_video"] = false;
						// For example, if the publisher is VP8 and this is Safari, let's avoid video
						//if(video !== "h264" && Janus.webRTCAdapter.browserDetails.browser === "safari") {
						//	if(video)
						//		video = video.toUpperCase()
						//	toastr.warning("Publisher is using " + video + ", but Safari doesn't support it: disabling video");
						//	listen["offer_video"] = false;
						//}
						if(id>0)
							remoteFeed.send({"message": listen});
					},
					error: function(error) {
						Janus.error("  -- Error attaching plugin...", error);
					},
					onmessage: function(msg, jsep) {
						Janus.debug(" ::: Got a message (listener) :::");
						Janus.debug(msg);
						var event = msg["videoroom"];
						Janus.debug("Event: " + event);
						if(msg["error"] !== undefined && msg["error"] !== null) {
							bootbox.alert(msg["error"]);
						} else if(event != undefined && event != null) {
							if(event === "attached") {
								// Subscriber created and attached
								if(feeds[1] === undefined || feeds[1] === null) {
									feeds[1] = remoteFeed;
									remoteFeed.rfindex = 1;
									break;
								}
								
								remoteFeed.rfid = msg["id"];
								remoteFeed.rfdisplay = msg["display"];
								if(remoteFeed.spinner === undefined || remoteFeed.spinner === null) {
									var target = document.getElementById('viewer');
									remoteFeed.spinner = new Spinner({top:100}).spin(target);
								} else {
									remoteFeed.spinner.spin();
								}
								Janus.log("Successfully attached to feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") in room " + msg["room"]);
								//$('#remote'+remoteFeed.rfindex).removeClass('hide').html(remoteFeed.rfdisplay).show();
							} else if(event === "event") {
								// Check if we got an event on a simulcast-related event from this publisher
								var substream = msg["substream"];
								var temporal = msg["temporal"];
								if((substream !== null && substream !== undefined) || (temporal !== null && temporal !== undefined)) {
									if(!remoteFeed.simulcastStarted) {
										remoteFeed.simulcastStarted = true;
										// Add some new buttons
										//addSimulcastButtons(remoteFeed.rfindex);
									}
									// We just received notice that there's been a switch, update the buttons
									//updateSimulcastButtons(remoteFeed.rfindex, substream, temporal);
								}
							} else {
								// What has just happened?
							}
						}
						if(jsep !== undefined && jsep !== null) {
							Janus.debug("Handling SDP as well...");
							Janus.debug(jsep);
							// Answer and attach
							remoteFeed.createAnswer(
								{
									jsep: jsep,
									// Add data:true here if you want to subscribe to datachannels as well
									// (obviously only works if the publisher offered them in the first place)
									media: { audioSend: false, videoSend: false },	// We want recvonly audio/video
									success: function(jsep) {
										Janus.debug("Got SDP!");
										Janus.debug(jsep);
										var body = { "request": "start", "room": myroom };
										remoteFeed.send({"message": body, "jsep": jsep});
									},
									error: function(error) {
										Janus.error("WebRTC error:", error);
										//bootbox.alert("WebRTC error... " + JSON.stringify(error));
									}
								});
						}
					},
					webrtcState: function(on) {
						Janus.log("Janus says this WebRTC PeerConnection (feed" + ") is " + (on ? "up" : "down") + " now");
					},
					onlocalstream: function(stream) {
						// The subscriber stream is recvonly, we don't expect anything here
					},
					onremotestream: function(stream) {
						Janus.debug("Remote feed");
						var addButtons = false;
							// No remote video yet
							var target = document.getElementById('viewer');
							if(target !== undefined && target !== null){
								$("#viewer").bind("playing", function () {
									if(remoteFeed.spinner !== undefined && remoteFeed.spinner !== null)
										remoteFeed.spinner.stop();
									remoteFeed.spinner = null;
									var width = this.videoWidth;
									var height = this.videoHeight;
								
								});
							}
							else
								return;
						
						Janus.attachMediaStream($('#viewer').get(0), stream);
						var videoTracks = stream.getVideoTracks();
						if(videoTracks === null || videoTracks === undefined || videoTracks.length === 0) {
							return;	
						}
						if(Janus.webRTCAdapter.browserDetails.browser === "chrome" || Janus.webRTCAdapter.browserDetails.browser === "firefox" ||
							Janus.webRTCAdapter.browserDetails.browser === "safari") {
							bitrateTimer[remoteFeed.rfindex] = setInterval(function() {
								// Display updated bitrate, if supported
								var bitrate = remoteFeed.getBitrate();	
							}, 1000);
						}
						if(!addButtons)
							return;
						
					},
					oncleanup: function() {
						Janus.log(" ::: Got a cleanup notification (remote feed " + id + ") :::");
						if(remoteFeed.spinner !== undefined && remoteFeed.spinner !== null)
							remoteFeed.spinner.stop();
						remoteFeed.spinner = null;
						if(bitrateTimer[remoteFeed.rfindex] !== null && bitrateTimer[remoteFeed.rfindex] !== null) 
							clearInterval(bitrateTimer[remoteFeed.rfindex]);
						bitrateTimer[remoteFeed.rfindex] = null;
						remoteFeed.simulcastStarted = false;
						
					}
				});
			},
			error: function(error) {
				Janus.error(error);
				bootbox.alert(error, function() {
					window.location.reload();
				});
			},
			destroyed: function() {
				window.location.reload();
			}
		});
	}});

*/