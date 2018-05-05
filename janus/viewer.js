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
var myroom = 1234;

var janus = null;
var sfutest = null;
var opaqueId = "videoroomtest-"+Janus.randomString(12);
var myusername = null;
var myid = null;
var mystream = null;
// We use this other ID just to map our subscriptions to us
var mypvtid;
var id;
var feeds = []
var bitrateTimer = [];

//var doSimulcast = (getQueryStringValue("simulcast") === "yes" || getQueryStringValue("simulcast") === "true");
/*
Janus.init({debug: "all", callback: function() {
	janus = new Janus(
	{
		server: server,
		success: function() {
			// Attach to video room test plugin
			janus.attach(
				{
					plugin: "janus.plugin.videoroom",
					opaqueId: opaqueId,
					success: function(pluginHandle) {
						sfutest = pluginHandle;
						Janus.log("Plugin attached! (" + sfutest.getPlugin() + ", id=" + sfutest.getId() + ")");
						Janus.log("  -- This is a publisher/manager");
						//config username to 
						//var register = { "request": "join", "room": myroom, "ptype": "publisher", "display": username };

						sfutest.send({"message": register, "callback":{success:function(data){Janus.log('ha')}}})

						//var register = {"request":"join", "ptype":"subscriber", "room":myroom, "feed":feed}
						//myusername = username;
						//sfutest.send({"message": register});
						
					},
					error: function(error) {
						Janus.error("  -- Error attaching plugin...", error);
						bootbox.alert("Error attaching plugin... " + error);
					},
					consentDialog: function(on) {
						Janus.debug("Consent dialog should be " + (on ? "on" : "off") + " now");
						if(on) {
							// Darken screen and show hint
						} else {
							// Restore screen
						}
					},
					mediaState: function(medium, on) {
						Janus.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
					},
					webrtcState: function(on) {
						return false;
					},
					onmessage: function(msg, jsep) {
						//Janus.debug(" ::: Got a message (subscriber) :::");
						//Janus.debug(msg);
						Janus.log("asdf")
						var event = msg["videoroom"];
						//Janus.debug("Event: " + event);
						if(event != undefined && event != null) {
							if (event === "participants"){
								Janus.log("asdf")

							}
							else if(event === "joined") {
								myid = msg["id"];
								mypvtid = msg["private_id"];
								Janus.log("Successfully joined room " + msg["room"] + " with ID " + myid);
							
								// Any new feed to attach to?
								if(msg["publishers"] === undefined || msg["publishers"] === null )
									console.log("no feed")
								else if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
									var list = msg["publishers"];
									Janus.debug("Got a list of available publishers/feeds:");
									Janus.debug(list);
									
									for(var f in list) {
										var id = list[f]["id"];
										var display = list[f]["display"];
										var audio = list[f]["audio_codec"];
										var video = list[f]["video_codec"];
										Janus.debug("  >> [" + id + "] " + display + " (audio: " + audio + ", video: " + video + ")");
										newRemoteFeed(id, display, audio, video);
									}
									
								}
							} else if(event === "destroyed") {
								// The room has been destroyed
								Janus.warn("The room has been destroyed!");
							} else if(event === "event") {
								// Any new feed to attach to?

								if(msg["participants"] !== undefined && msg["participants"] !== null)
									Janus.log(msg["participants"])
								else if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
									var list = msg["publishers"];
									Janus.debug("Got a list of available publishers/feeds:");
									Janus.debug(list);
									for(var f in list) {
										var id = list[f]["id"];
										var display = list[f]["display"];
										var audio = list[f]["audio_codec"];
										var video = list[f]["video_codec"];
										Janus.debug("  >> [" + id + "] " + display + " (audio: " + audio + ", video: " + video + ")");
										newRemoteFeed(id, display, audio, video);
									}
								} else if(msg["leaving"] !== undefined && msg["leaving"] !== null) {
									// One of the publishers has gone away?
									var leaving = msg["leaving"];
									Janus.log("Publisher left: " + leaving);
									var remoteFeed = null;
									for(var i=1; i<6; i++) {
										if(feeds[i] != null && feeds[i] != undefined && feeds[i].rfid == leaving) {
											remoteFeed = feeds[i];
											break;
										}
									}
									if(remoteFeed != null) {
										Janus.debug("Feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") has left the room, detaching");
										feeds[remoteFeed.rfindex] = null;
										remoteFeed.detach();
									}
								} else if(msg["unpublished"] !== undefined && msg["unpublished"] !== null) {
									// One of the publishers has unpublished?
									var unpublished = msg["unpublished"];
									Janus.log("Publisher left: " + unpublished);
									if(unpublished === 'ok') {
										// That's us
										sfutest.hangup();
										return;
									}
									var remoteFeed = null;
									for(var i=1; i<6; i++) {
										if(feeds[i] != null && feeds[i] != undefined && feeds[i].rfid == unpublished) {
											remoteFeed = feeds[i];
											break;
										}
									}
									if(remoteFeed != null) {
										Janus.debug("Feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") has left the room, detaching");
										feeds[remoteFeed.rfindex] = null;
										remoteFeed.detach();
									}
								} else if(msg["error"] !== undefined && msg["error"] !== null) {
									if(msg["error_code"] === 426) {
										// This is a "no such room" error: give a more meaningful description
									} else {
									}
								}
							}
						}
						if(jsep !== undefined && jsep !== null) {
							Janus.debug("Handling SDP as well...");
							Janus.debug(jsep);
							sfutest.handleRemoteJsep({jsep: jsep});
							// Check if any of the media we wanted to publish has
							// been rejected (e.g., wrong or unsupported codec)
							var audio = msg["audio_codec"];
							if(mystream && mystream.getAudioTracks() && mystream.getAudioTracks().length > 0 && !audio) {
								// Audio has been rejected
								toastr.warning("Our audio stream has been rejected, viewers won't hear us");
							}
							var video = msg["video_codec"];
							if(mystream && mystream.getVideoTracks() && mystream.getVideoTracks().length > 0 && !video) {
								// Video has been rejected
								toastr.warning("Our video stream has been rejected, viewers won't see us");
								// Hide the webcam video
							}
						}
					},
					onlocalstream: function(stream) {
						
					},
					onremotestream: function(stream) {
						// The publisher stream is sendonly, we don't expect anything here
					},
					oncleanup: function() {
						Janus.log(" ::: Got a cleanup notification: we are unpublished now :::");
						mystream = null;
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


Janus.init({debug: "all", callback: function() {
	var id = 4025782700030530;
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
						var listen = { "request": "join", "room": myroom, "ptype": "listener", "feed": id, "private_id": mypvtid };
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
						bootbox.alert("Error attaching plugin... " + error);
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
								for(var i=1;i<2;i++) {
									if(feeds[i] === undefined || feeds[i] === null) {
										feeds[i] = remoteFeed;
										remoteFeed.rfindex = i;
										break;
									}
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
										addSimulcastButtons(remoteFeed.rfindex);
									}
									// We just received notice that there's been a switch, update the buttons
									updateSimulcastButtons(remoteFeed.rfindex, substream, temporal);
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
						Janus.log("Janus says this WebRTC PeerConnection (feed #" + remoteFeed.rfindex + ") is " + (on ? "up" : "down") + " now");
					},
					onlocalstream: function(stream) {
						// The subscriber stream is recvonly, we don't expect anything here
					},
					onremotestream: function(stream) {
						Janus.debug("Remote feed #" + remoteFeed.rfindex);
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



/*
Janus.init({debug: "all", callback: function() {
	console.log('start!')
		// Make sure the browser supports WebRTC
		if(!Janus.isWebrtcSupported()) {
			Janus.log("No WebRTC support")
			return;
		}
		// Create session
		janus = new Janus(
			{
				server: server,
				success: function() {
					// Attach to video room test plugin
					var remoteFeed = null;
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
							var listen = { "request": "join", "room": myroom, "ptype": "listener", "feed": id, "private_id": mypvtid };
							
							var video = 'h264';
							if(video !== "h264" && Janus.webRTCAdapter.browserDetails.browser === "safari") {
								if(video)
									video = video.toUpperCase()
								toastr.warning("Publisher is using " + video + ", but Safari doesn't support it: disabling video");
								listen["offer_video"] = false;
							}
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
								Janus.log(msg["error"]);
							} else if(event != undefined && event != null) {
								if(event === "attached") {
									// Subscriber created and attached
									for(var i=1;i<6;i++) {
										if(feeds[i] === undefined || feeds[i] === null) {
											feeds[i] = remoteFeed;
											remoteFeed.rfindex = i;
											break;
										}
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
								} else if(event === "event") {
									// Check if we got an event on a simulcast-related event from this publisher
									var substream = msg["substream"];
									var temporal = msg["temporal"];
									if((substream !== null && substream !== undefined) || (temporal !== null && temporal !== undefined)) {
										if(!remoteFeed.simulcastStarted) {
											remoteFeed.simulcastStarted = true;
											// Add some new buttons
											addSimulcastButtons(remoteFeed.rfindex);
										}
										// We just received notice that there's been a switch, update the buttons
										updateSimulcastButtons(remoteFeed.rfindex, substream, temporal);
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
							Janus.debug("Remote feed #" + remoteFeed.rfindex);
							var addButtons = false;
							window.$("viewer").bind("playing", function () {
								if(remoteFeed.spinner !== undefined && remoteFeed.spinner !== null)
									remoteFeed.spinner.stop();
								remoteFeed.spinner = null;
							
								var width = this.videoWidth;
								var height = this.videoHeight;
							//	if(Janus.webRTCAdapter.browserDetails.browser === "firefox") {
							//		// Firefox Stable has a bug: width and height are not immediately available after a playing
							//		setTimeout(function() {
							//			var width = $("#remotevideo"+remoteFeed.rfindex).get(0).videoWidth;
							//			var height = $("#remotevideo"+remoteFeed.rfindex).get(0).videoHeight;
							//			$('#curres'+remoteFeed.rfindex).removeClass('hide').text(width+'x'+height).show();
							//		}, 2000);
							//	}
							});
							
							Janus.attachMediaStream(window.$('#viewer').get(0), stream);
							var videoTracks = stream.getVideoTracks();
							if(videoTracks === null || videoTracks === undefined || videoTracks.length === 0) {
								return;
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
				}
			})
	}
});
*/

function checkEnter(field, event) {
	var theCode = event.keyCode ? event.keyCode : event.which ? event.which : event.charCode;
	if(theCode == 13) {
		registerUsername();
		return false;
	} else {
		return true;
	}
}

/*
function publishOwnFeed(useAudio) {
	// Publish our stream
	$('#publish').attr('disabled', true).unbind('click');
	sfutest.createOffer(
		{
			// Add data:true here if you want to publish datachannels as well
			media: { audioRecv: false, videoRecv: false, audioSend: useAudio, videoSend: true },	// Publishers are sendonly
			// If you want to test simulcasting (Chrome and Firefox only), then
			// pass a ?simulcast=true when opening this demo page: it will turn
			// the following 'simulcast' property to pass to janus.js to true
			simulcast: doSimulcast,
			success: function(jsep) {
				Janus.debug("Got publisher SDP!");
				Janus.debug(jsep);
				var publish = { "request": "configure", "audio": useAudio, "video": true };
				// You can force a specific codec to use when publishing by using the
				// audiocodec and videocodec properties, for instance:
				// 		publish["audiocodec"] = "opus"
				// to force Opus as the audio codec to use, or:
				// 		publish["videocodec"] = "vp9"
				// to force VP9 as the videocodec to use. In both case, though, forcing
				// a codec will only work if: (1) the codec is actually in the SDP (and
				// so the browser supports it), and (2) the codec is in the list of
				// allowed codecs in a room. With respect to the point (2) above,
				// refer to the text in janus.plugin.videoroom.cfg for more details
				sfutest.send({"message": publish, "jsep": jsep});
			},
			error: function(error) {
				Janus.error("WebRTC error:", error);
				if (useAudio) {
					 publishOwnFeed(false);
				} else {
					bootbox.alert("WebRTC error... " + JSON.stringify(error));
					$('#publish').removeAttr('disabled').click(function() { publishOwnFeed(true); });
				}
			}
		});
}
*/

/*
function toggleMute() {
	var muted = sfutest.isAudioMuted();
	Janus.log((muted ? "Unmuting" : "Muting") + " local stream...");
	if(muted)
		sfutest.unmuteAudio();
	else
		sfutest.muteAudio();
	muted = sfutest.isAudioMuted();
	$('#mute').html(muted ? "Unmute" : "Mute");
}
*/

/*
function unpublishOwnFeed() {
	// Unpublish our stream
	$('#unpublish').attr('disabled', true).unbind('click');
	var unpublish = { "request": "unpublish" };
	sfutest.send({"message": unpublish});
}
*/

/*
function newRemoteFeed(id, display, audio, video) {
	// A new feed has been published, create a new plugin handle and attach to it as a listener
	var remoteFeed = null;
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
				var listen = { "request": "join", "room": myroom, "ptype": "listener", "feed": id, "private_id": mypvtid };
				// In case you don't want to receive audio, video or data, even if the
				// publisher is sending them, set the 'offer_audio', 'offer_video' or
				// 'offer_data' properties to false (they're true by default), e.g.:
				// 		listen["offer_video"] = false;
				// For example, if the publisher is VP8 and this is Safari, let's avoid video
				if(video !== "h264" && Janus.webRTCAdapter.browserDetails.browser === "safari") {
					if(video)
						video = video.toUpperCase()
					toastr.warning("Publisher is using " + video + ", but Safari doesn't support it: disabling video");
					listen["offer_video"] = false;
				}
				remoteFeed.send({"message": listen});
			},
			error: function(error) {
				Janus.error("  -- Error attaching plugin...", error);
				bootbox.alert("Error attaching plugin... " + error);
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
						for(var i=1;i<6;i++) {
							if(feeds[i] === undefined || feeds[i] === null) {
								feeds[i] = remoteFeed;
								remoteFeed.rfindex = i;
								break;
							}
						}
						remoteFeed.rfid = msg["id"];
						remoteFeed.rfdisplay = msg["display"];
						if(remoteFeed.spinner === undefined || remoteFeed.spinner === null) {
							var target = document.getElementById('videoremote'+remoteFeed.rfindex);
							remoteFeed.spinner = new Spinner({top:100}).spin(target);
						} else {
							remoteFeed.spinner.spin();
						}
						Janus.log("Successfully attached to feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") in room " + msg["room"]);
						$('#remote'+remoteFeed.rfindex).removeClass('hide').html(remoteFeed.rfdisplay).show();
					} else if(event === "event") {
						// Check if we got an event on a simulcast-related event from this publisher
						var substream = msg["substream"];
						var temporal = msg["temporal"];
						if((substream !== null && substream !== undefined) || (temporal !== null && temporal !== undefined)) {
							if(!remoteFeed.simulcastStarted) {
								remoteFeed.simulcastStarted = true;
								// Add some new buttons
								addSimulcastButtons(remoteFeed.rfindex);
							}
							// We just received notice that there's been a switch, update the buttons
							updateSimulcastButtons(remoteFeed.rfindex, substream, temporal);
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
				Janus.debug("Remote feed #" + remoteFeed.rfindex);
				var addButtons = false;
				if($('#remotevideo'+remoteFeed.rfindex).length === 0) {
					addButtons = true;
					// No remote video yet
					$('#videoremote'+remoteFeed.rfindex).append('<video class="rounded centered" id="waitingvideo' + remoteFeed.rfindex + '" width=320 height=240 />');
					$('#videoremote'+remoteFeed.rfindex).append('<video class="rounded centered relative hide" id="remotevideo' + remoteFeed.rfindex + '" width="100%" height="100%" autoplay/>');
					$('#videoremote'+remoteFeed.rfindex).append(
						'<span class="label label-primary hide" id="curres'+remoteFeed.rfindex+'" style="position: absolute; bottom: 0px; left: 0px; margin: 15px;"></span>' +
						'<span class="label label-info hide" id="curbitrate'+remoteFeed.rfindex+'" style="position: absolute; bottom: 0px; right: 0px; margin: 15px;"></span>');
					// Show the video, hide the spinner and show the resolution when we get a playing event
					$("#remotevideo"+remoteFeed.rfindex).bind("playing", function () {
						if(remoteFeed.spinner !== undefined && remoteFeed.spinner !== null)
							remoteFeed.spinner.stop();
						remoteFeed.spinner = null;
						$('#waitingvideo'+remoteFeed.rfindex).remove();
						if(this.videoWidth)
							$('#remotevideo'+remoteFeed.rfindex).removeClass('hide').show();
						var width = this.videoWidth;
						var height = this.videoHeight;
						$('#curres'+remoteFeed.rfindex).removeClass('hide').text(width+'x'+height).show();
						if(Janus.webRTCAdapter.browserDetails.browser === "firefox") {
							// Firefox Stable has a bug: width and height are not immediately available after a playing
							setTimeout(function() {
								var width = $("#remotevideo"+remoteFeed.rfindex).get(0).videoWidth;
								var height = $("#remotevideo"+remoteFeed.rfindex).get(0).videoHeight;
								$('#curres'+remoteFeed.rfindex).removeClass('hide').text(width+'x'+height).show();
							}, 2000);
						}
					});
				}
				Janus.attachMediaStream($('#remotevideo'+remoteFeed.rfindex).get(0), stream);
				var videoTracks = stream.getVideoTracks();
				if(videoTracks === null || videoTracks === undefined || videoTracks.length === 0) {
					// No remote video
					$('#remotevideo'+remoteFeed.rfindex).hide();
					if($('#remotevideo'+remoteFeed.rfindex + ' .no-video-container').length === 0) {
						$('#remotevideo'+remoteFeed.rfindex).append(
							'<div class="no-video-container">' +
								'<i class="fa fa-video-camera fa-5 no-video-icon"></i>' +
								'<span class="no-video-text">No remote video available</span>' +
							'</div>');
					}
				} else {
					$('#remotevideo'+remoteFeed.rfindex+ ' .no-video-container').remove();
					$('#remotevideo'+remoteFeed.rfindex).removeClass('hide').show();
				}
				if(!addButtons)
					return;
				if(Janus.webRTCAdapter.browserDetails.browser === "chrome" || Janus.webRTCAdapter.browserDetails.browser === "firefox" ||
						Janus.webRTCAdapter.browserDetails.browser === "safari") {
					$('#curbitrate'+remoteFeed.rfindex).removeClass('hide').show();
					bitrateTimer[remoteFeed.rfindex] = setInterval(function() {
						// Display updated bitrate, if supported
						var bitrate = remoteFeed.getBitrate();
						$('#curbitrate'+remoteFeed.rfindex).text(bitrate);
						// Check if the resolution changed too
						var width = $("#remotevideo"+remoteFeed.rfindex).get(0).videoWidth;
						var height = $("#remotevideo"+remoteFeed.rfindex).get(0).videoHeight;
						if(width > 0 && height > 0)
							$('#curres'+remoteFeed.rfindex).removeClass('hide').text(width+'x'+height).show();
					}, 1000);
				}
			},
			oncleanup: function() {
				Janus.log(" ::: Got a cleanup notification (remote feed " + id + ") :::");
				if(remoteFeed.spinner !== undefined && remoteFeed.spinner !== null)
					remoteFeed.spinner.stop();
				remoteFeed.spinner = null;
				$('#remotevideo'+remoteFeed.rfindex).remove();
				$('#waitingvideo'+remoteFeed.rfindex).remove();
				$('#novideo'+remoteFeed.rfindex).remove();
				$('#curbitrate'+remoteFeed.rfindex).remove();
				$('#curres'+remoteFeed.rfindex).remove();
				if(bitrateTimer[remoteFeed.rfindex] !== null && bitrateTimer[remoteFeed.rfindex] !== null) 
					clearInterval(bitrateTimer[remoteFeed.rfindex]);
				bitrateTimer[remoteFeed.rfindex] = null;
				remoteFeed.simulcastStarted = false;
				$('#simulcast'+remoteFeed.rfindex).remove();
			}
		});
}
*/


/*
// Helper to parse query string
function getQueryStringValue(name) {
	name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
	var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
		results = regex.exec(location.search);
	return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

// Helpers to create Simulcast-related UI, if enabled
function addSimulcastButtons(feed) {
	var index = feed;
	$('#remote'+index).parent().append(
		'<div id="simulcast'+index+'" class="btn-group-vertical btn-group-vertical-xs pull-right">' +
		'	<div class"row">' +
		'		<div class="btn-group btn-group-xs" style="width: 100%">' +
		'			<button id="sl'+index+'-2" type="button" class="btn btn-primary" data-toggle="tooltip" title="Switch to higher quality" style="width: 33%">SL 2</button>' +
		'			<button id="sl'+index+'-1" type="button" class="btn btn-primary" data-toggle="tooltip" title="Switch to normal quality" style="width: 33%">SL 1</button>' +
		'			<button id="sl'+index+'-0" type="button" class="btn btn-primary" data-toggle="tooltip" title="Switch to lower quality" style="width: 34%">SL 0</button>' +
		'		</div>' +
		'	</div>' +
		'	<div class"row">' +
		'		<div class="btn-group btn-group-xs" style="width: 100%">' +
		'			<button id="tl'+index+'-2" type="button" class="btn btn-primary" data-toggle="tooltip" title="Cap to temporal layer 2" style="width: 34%">TL 2</button>' +
		'			<button id="tl'+index+'-1" type="button" class="btn btn-primary" data-toggle="tooltip" title="Cap to temporal layer 1" style="width: 33%">TL 1</button>' +
		'			<button id="tl'+index+'-0" type="button" class="btn btn-primary" data-toggle="tooltip" title="Cap to temporal layer 0" style="width: 33%">TL 0</button>' +
		'		</div>' +
		'	</div>' +
		'</div>'
	);
	// Enable the VP8 simulcast selection buttons
	$('#sl' + index + '-0').removeClass('btn-primary btn-success').addClass('btn-primary')
		.unbind('click').click(function() {
			toastr.info("Switching simulcast substream, wait for it... (lower quality)", null, {timeOut: 2000});
			if(!$('#sl' + index + '-2').hasClass('btn-success'))
				$('#sl' + index + '-2').removeClass('btn-primary btn-info').addClass('btn-primary');
			if(!$('#sl' + index + '-1').hasClass('btn-success'))
				$('#sl' + index + '-1').removeClass('btn-primary btn-info').addClass('btn-primary');
			$('#sl' + index + '-0').removeClass('btn-primary btn-info btn-success').addClass('btn-info');
			feeds[index].send({message: { request: "configure", substream: 0 }});
		});
	$('#sl' + index + '-1').removeClass('btn-primary btn-success').addClass('btn-primary')
		.unbind('click').click(function() {
			toastr.info("Switching simulcast substream, wait for it... (normal quality)", null, {timeOut: 2000});
			if(!$('#sl' + index + '-2').hasClass('btn-success'))
				$('#sl' + index + '-2').removeClass('btn-primary btn-info').addClass('btn-primary');
			$('#sl' + index + '-1').removeClass('btn-primary btn-info btn-success').addClass('btn-info');
			if(!$('#sl' + index + '-0').hasClass('btn-success'))
				$('#sl' + index + '-0').removeClass('btn-primary btn-info').addClass('btn-primary');
			feeds[index].send({message: { request: "configure", substream: 1 }});
		});
	$('#sl' + index + '-2').removeClass('btn-primary btn-success').addClass('btn-primary')
		.unbind('click').click(function() {
			toastr.info("Switching simulcast substream, wait for it... (higher quality)", null, {timeOut: 2000});
			$('#sl' + index + '-2').removeClass('btn-primary btn-info btn-success').addClass('btn-info');
			if(!$('#sl' + index + '-1').hasClass('btn-success'))
				$('#sl' + index + '-1').removeClass('btn-primary btn-info').addClass('btn-primary');
			if(!$('#sl' + index + '-0').hasClass('btn-success'))
				$('#sl' + index + '-0').removeClass('btn-primary btn-info').addClass('btn-primary');
			feeds[index].send({message: { request: "configure", substream: 2 }});
		});
	$('#tl' + index + '-0').removeClass('btn-primary btn-success').addClass('btn-primary')
		.unbind('click').click(function() {
			toastr.info("Capping simulcast temporal layer, wait for it... (lowest FPS)", null, {timeOut: 2000});
			if(!$('#tl' + index + '-2').hasClass('btn-success'))
				$('#tl' + index + '-2').removeClass('btn-primary btn-info').addClass('btn-primary');
			if(!$('#tl' + index + '-1').hasClass('btn-success'))
				$('#tl' + index + '-1').removeClass('btn-primary btn-info').addClass('btn-primary');
			$('#tl' + index + '-0').removeClass('btn-primary btn-info btn-success').addClass('btn-info');
			feeds[index].send({message: { request: "configure", temporal: 0 }});
		});
	$('#tl' + index + '-1').removeClass('btn-primary btn-success').addClass('btn-primary')
		.unbind('click').click(function() {
			toastr.info("Capping simulcast temporal layer, wait for it... (medium FPS)", null, {timeOut: 2000});
			if(!$('#tl' + index + '-2').hasClass('btn-success'))
				$('#tl' + index + '-2').removeClass('btn-primary btn-info').addClass('btn-primary');
			$('#tl' + index + '-1').removeClass('btn-primary btn-info').addClass('btn-info');
			if(!$('#tl' + index + '-0').hasClass('btn-success'))
				$('#tl' + index + '-0').removeClass('btn-primary btn-info').addClass('btn-primary');
			feeds[index].send({message: { request: "configure", temporal: 1 }});
		});
	$('#tl' + index + '-2').removeClass('btn-primary btn-success').addClass('btn-primary')
		.unbind('click').click(function() {
			toastr.info("Capping simulcast temporal layer, wait for it... (highest FPS)", null, {timeOut: 2000});
			$('#tl' + index + '-2').removeClass('btn-primary btn-info btn-success').addClass('btn-info');
			if(!$('#tl' + index + '-1').hasClass('btn-success'))
				$('#tl' + index + '-1').removeClass('btn-primary btn-info').addClass('btn-primary');
			if(!$('#tl' + index + '-0').hasClass('btn-success'))
				$('#tl' + index + '-0').removeClass('btn-primary btn-info').addClass('btn-primary');
			feeds[index].send({message: { request: "configure", temporal: 2 }});
		});
}

function updateSimulcastButtons(feed, substream, temporal) {
	// Check the substream
	var index = feed;
	if(substream === 0) {
		toastr.success("Switched simulcast substream! (lower quality)", null, {timeOut: 2000});
		$('#sl' + index + '-2').removeClass('btn-primary btn-success').addClass('btn-primary');
		$('#sl' + index + '-1').removeClass('btn-primary btn-success').addClass('btn-primary');
		$('#sl' + index + '-0').removeClass('btn-primary btn-info btn-success').addClass('btn-success');
	} else if(substream === 1) {
		toastr.success("Switched simulcast substream! (normal quality)", null, {timeOut: 2000});
		$('#sl' + index + '-2').removeClass('btn-primary btn-success').addClass('btn-primary');
		$('#sl' + index + '-1').removeClass('btn-primary btn-info btn-success').addClass('btn-success');
		$('#sl' + index + '-0').removeClass('btn-primary btn-success').addClass('btn-primary');
	} else if(substream === 2) {
		toastr.success("Switched simulcast substream! (higher quality)", null, {timeOut: 2000});
		$('#sl' + index + '-2').removeClass('btn-primary btn-info btn-success').addClass('btn-success');
		$('#sl' + index + '-1').removeClass('btn-primary btn-success').addClass('btn-primary');
		$('#sl' + index + '-0').removeClass('btn-primary btn-success').addClass('btn-primary');
	}
	// Check the temporal layer
	if(temporal === 0) {
		toastr.success("Capped simulcast temporal layer! (lowest FPS)", null, {timeOut: 2000});
		$('#tl' + index + '-2').removeClass('btn-primary btn-success').addClass('btn-primary');
		$('#tl' + index + '-1').removeClass('btn-primary btn-success').addClass('btn-primary');
		$('#tl' + index + '-0').removeClass('btn-primary btn-info btn-success').addClass('btn-success');
	} else if(temporal === 1) {
		toastr.success("Capped simulcast temporal layer! (medium FPS)", null, {timeOut: 2000});
		$('#tl' + index + '-2').removeClass('btn-primary btn-success').addClass('btn-primary');
		$('#tl' + index + '-1').removeClass('btn-primary btn-info btn-success').addClass('btn-success');
		$('#tl' + index + '-0').removeClass('btn-primary btn-success').addClass('btn-primary');
	} else if(temporal === 2) {
		toastr.success("Capped simulcast temporal layer! (highest FPS)", null, {timeOut: 2000});
		$('#tl' + index + '-2').removeClass('btn-primary btn-info btn-success').addClass('btn-success');
		$('#tl' + index + '-1').removeClass('btn-primary btn-success').addClass('btn-primary');
		$('#tl' + index + '-0').removeClass('btn-primary btn-success').addClass('btn-primary');
	}
}
*/
