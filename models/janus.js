/*
	The MIT License (MIT)

	Copyright (c) 2016 Meetecho

	Permission is hereby granted, free of charge, to any person obtaining
	a copy of this software and associated documentation files (the "Software"),
	to deal in the Software without restriction, including without limitation
	the rights to use, copy, modify, merge, publish, distribute, sublicense,
	and/or sell copies of the Software, and to permit persons to whom the
	Software is furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included
	in all copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
	OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
	THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR
	OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
	ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
	OTHER DEALINGS IN THE SOFTWARE.
 */
// List of sessions
var Request = require('request')
var media = {};
Janus.sessions = {};

// Screensharing Chrome Extension ID
Janus.extensionId = "hapfgfdkleiggjjpfpenajgdnfckjpaj";

Janus.isExtensionEnabled = function() {
	return true;
};

Janus.useDefaultDependencies = function (deps) {
	var f = (deps && deps.fetch) || Request;
	var p = (deps && deps.Promise) || Promise;
	return {
		isArray: function(arr) { return Array.isArray(arr); },
		httpAPICall: function(url, options) {
			var fetchOptions = {
				method: options.verb,
				headers: {
					'Accept': 'application/json, text/plain, */*'
				},
				cache: 'no-cache'
			};
			var requestOptions = {
				url: url,
				body: JSON.stringify(options.body),
				method: options.verb,
				headers: {
					'Accept': 'application/json, text/plain, */*'
				},
				cache: 'no-cache'
			}
			if(options.verb === "POST") {
				fetchOptions.headers['Content-Type'] = 'application/json';
			}
			if(options.withCredentials !== undefined) {
				fetchOptions.credentials = options.withCredentials === true ? 'include' : (options.withCredentials ? options.withCredentials : 'omit');
			}
			if(options.body !== undefined) {
				fetchOptions.body = JSON.stringify(options.body);
			}
			var fetching = new Promise( (resolve, reject) =>{
				f(requestOptions, function(error, response, body){
					if(error)
						reject({message: 'Probably a network error, is the gateway down?', error: error});
					else{
						var result = JSON.parse(body)
						if(response.statusCode == 200)
							result.ok = true
						resolve(result)
					}
				})}
			)
			if(options.timeout !== undefined) {
				var timeout = new p(function(resolve, reject) {
					var timerId = setTimeout(function() {
						clearTimeout(timerId);
						return reject({message: 'Request timed out', timeout: options.timeout});
					}, options.timeout);
				});
				fetching = p.race([fetching,timeout]);
			}

			fetching.then(function(response) {
				if(response.ok) {
					if(typeof(options.success) === typeof(Janus.noop)) {
						return options.success(response)
					}
				}
				else {
					return p.reject({message: 'API call failed', response: response});
				}
			}).catch(function(error) {
				if(typeof(options.error) === typeof(Janus.noop)) {
					options.error(error.message || '<< internal error >>', error);
				}
			});

			return fetching;
		}
	}
};

Janus.noop = function() {};

// Initialization
media.init = Janus.init = function(options) {
	options = options || {};
	options.callback = (typeof options.callback == "function") ? options.callback : Janus.noop;
	if(Janus.initDone === true) {
		// Already initialized
		options.callback();
	} else {
		if(typeof console == "undefined" || typeof console.log == "undefined")
			console = { log: function() {} };
		// Console logging (all debugging disabled by default)
		Janus.trace = Janus.noop;
		Janus.debug = Janus.noop;
		Janus.vdebug = Janus.noop;
		Janus.log = Janus.noop;
		Janus.warn = Janus.noop;
		Janus.error = Janus.noop;
		if(options.debug === true || options.debug === "all") {
			// Enable all debugging levels
			Janus.trace = console.trace.bind(console);
			Janus.debug = console.debug.bind(console);
			Janus.vdebug = console.debug.bind(console);
			Janus.log = console.log.bind(console);
			Janus.warn = console.warn.bind(console);
			Janus.error = console.error.bind(console);
		} else if(Array.isArray(options.debug)) {
			for(var i in options.debug) {
				var d = options.debug[i];
				switch(d) {
					case "trace":
						Janus.trace = console.trace.bind(console);
						break;
					case "debug":
						Janus.debug = console.debug.bind(console);
						break;
					case "vdebug":
						Janus.vdebug = console.debug.bind(console);
						break;
					case "log":
						Janus.log = console.log.bind(console);
						break;
					case "warn":
						Janus.warn = console.warn.bind(console);
						break;
					case "error":
						Janus.error = console.error.bind(console);
						break;
					default:
						console.error("Unknown debugging option '" + d + "' (supported: 'trace', 'debug', 'vdebug', 'log', warn', 'error')");
						break;
				}
			}
		}
		Janus.log("Initializing library");
		
		var usedDependencies = options.dependencies || Janus.useDefaultDependencies();
		Janus.isArray = usedDependencies.isArray;
		Janus.httpAPICall = usedDependencies.httpAPICall;

		// Helper method to enumerate devices
		Janus.listDevices = function(callback, config) {
			callback = (typeof callback == "function") ? callback : Janus.noop;
			if (config == null) config = { audio: true, video: true };
			if(navigator.mediaDevices) {
				navigator.mediaDevices.getUserMedia(config)
				.then(function(stream) {
					navigator.mediaDevices.enumerateDevices().then(function(devices) {
						Janus.debug(devices);
						callback(devices);
						// Get rid of the now useless stream
						try {
							var tracks = stream.getTracks();
							for(var i in tracks) {
								var mst = tracks[i];
								if(mst !== null && mst !== undefined)
									mst.stop();
							}
						} catch(e) {}
					});
				})
				.catch(function(err) {
					Janus.error(err);
					callback([]);
				});
			} else {
				Janus.warn("navigator.mediaDevices unavailable");
				callback([]);
			}
		}
		Janus.initDone = true;
		options.callback();
	}
};


// Helper method to create random identifiers (e.g., transaction)
media.randomString = Janus.randomString = function(len) {
	var charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	var randomString = '';
	for (var i = 0; i < len; i++) {
		var randomPoz = Math.floor(Math.random() * charSet.length);
		randomString += charSet.substring(randomPoz,randomPoz+1);
	}
	return randomString;
}

function Janus(gatewayCallbacks) {
	if(Janus.initDone === undefined) {
		gatewayCallbacks.error("Library not initialized");
		return {};
	}
	Janus.log("Library initialized: " + Janus.initDone);
	gatewayCallbacks = gatewayCallbacks || {};
	gatewayCallbacks.success = (typeof gatewayCallbacks.success == "function") ? gatewayCallbacks.success : Janus.noop;
	gatewayCallbacks.error = (typeof gatewayCallbacks.error == "function") ? gatewayCallbacks.error : Janus.noop;
	gatewayCallbacks.destroyed = (typeof gatewayCallbacks.destroyed == "function") ? gatewayCallbacks.destroyed : Janus.noop;
	if(gatewayCallbacks.server === null || gatewayCallbacks.server === undefined) {
		gatewayCallbacks.error("Invalid gateway url");
		return {};
	}
	var websockets = false;
	var ws = null;
	var wsHandlers = {};
	var wsKeepaliveTimeoutId = null;

	var servers = null, serversIndex = 0;
	var server = gatewayCallbacks.server;
	if(Janus.isArray(server)) {
		Janus.log("Multiple servers provided (" + server.length + "), will use the first that works");
		server = null;
		servers = gatewayCallbacks.server;
		Janus.debug(servers);
	} else {
		if(server.indexOf("ws") === 0) {
			websockets = true;
			Janus.log("Using WebSockets to contact Janus: " + server);
		} else {
			websockets = false;
			Janus.log("Using REST API to contact Janus: " + server);
		}
	}
	var iceServers = gatewayCallbacks.iceServers;
	if(iceServers === undefined || iceServers === null)
		iceServers = [{urls: "stun:stun.l.google.com:19302"}];
	var iceTransportPolicy = gatewayCallbacks.iceTransportPolicy;
	var bundlePolicy = gatewayCallbacks.bundlePolicy;
	// Whether IPv6 candidates should be gathered
	var ipv6Support = gatewayCallbacks.ipv6;
	if(ipv6Support === undefined || ipv6Support === null)
		ipv6Support = false;
	// Whether we should enable the withCredentials flag for XHR requests
	var withCredentials = false;
	if(gatewayCallbacks.withCredentials !== undefined && gatewayCallbacks.withCredentials !== null)
		withCredentials = gatewayCallbacks.withCredentials === true;
	// Optional max events
	var maxev = null;
	if(gatewayCallbacks.max_poll_events !== undefined && gatewayCallbacks.max_poll_events !== null)
		maxev = gatewayCallbacks.max_poll_events;
	if(maxev < 1)
		maxev = 1;
	// Token to use (only if the token based authentication mechanism is enabled)
	var token = null;
	if(gatewayCallbacks.token !== undefined && gatewayCallbacks.token !== null)
		token = gatewayCallbacks.token;
	// API secret to use (only if the shared API secret is enabled)
	var apisecret = null;
	if(gatewayCallbacks.apisecret !== undefined && gatewayCallbacks.apisecret !== null)
		apisecret = gatewayCallbacks.apisecret;
	// Whether we should destroy this session when onbeforeunload is called
	this.destroyOnUnload = true;
	if(gatewayCallbacks.destroyOnUnload !== undefined && gatewayCallbacks.destroyOnUnload !== null)
		this.destroyOnUnload = (gatewayCallbacks.destroyOnUnload === true);

	var connected = false;
	var sessionId = null;
	var pluginHandles = {};
	var that = this;
	var retries = 0;
	var transactions = {};
	createSession(gatewayCallbacks);

	// Public methods
	this.getServer = function() { return server; };
	this.isConnected = function() { return connected; };
	this.getSessionId = function() { return sessionId; };
	this.destroy = function(callbacks) { destroySession(callbacks); };
	this.attach = function(callbacks) { createHandle(callbacks); };

	function eventHandler() {
		if(sessionId == null)
			return;
		Janus.debug('Long poll...');
		if(!connected) {
			Janus.warn("Is the gateway down? (connected=false)");
			return;
		}
		var longpoll = server + "/" + sessionId + "?rid=" + new Date().getTime();
		if(maxev !== undefined && maxev !== null)
			longpoll = longpoll + "&maxev=" + maxev;
		if(token !== null && token !== undefined)
			longpoll = longpoll + "&token=" + token;
		if(apisecret !== null && apisecret !== undefined)
			longpoll = longpoll + "&apisecret=" + apisecret;
		Janus.httpAPICall(longpoll, {
			verb: 'GET',
			withCredentials: withCredentials,
			success: handleEvent,
			timeout: 60000,	// FIXME
			error: function(textStatus, errorThrown) {
				Janus.error(textStatus + ":", errorThrown);
				retries++;
				if(retries > 3) {
					// Did we just lose the gateway? :-(
					connected = false;
					gatewayCallbacks.error("Lost connection to the gateway (is it down?)");
					return;
				}
				eventHandler();
			}
		});
	}

	// Private event handler: this will trigger plugin callbacks, if set
	function handleEvent(json, skipTimeout) {
		retries = 0;
		if(!websockets && sessionId !== undefined && sessionId !== null && skipTimeout !== true)
			setTimeout(eventHandler, 200);
		if(!websockets && Janus.isArray(json)) {
			// We got an array: it means we passed a maxev > 1, iterate on all objects
			for(var i=0; i<json.length; i++) {
				handleEvent(json[i], true);
			}
			return;
		}
		if(json["janus"] === "keepalive") {
			// Nothing happened
			Janus.vdebug("Got a keepalive on session " + sessionId);
			return;
		} else if(json["janus"] === "ack") {
			// Just an ack, we can probably ignore
			Janus.debug("Got an ack on session " + sessionId);
			Janus.debug(json);
			var transaction = json["transaction"];
			if(transaction !== null && transaction !== undefined) {
				var reportSuccess = transactions[transaction];
				if(reportSuccess !== null && reportSuccess !== undefined) {
					reportSuccess(json);
				}
				delete transactions[transaction];
			}
			return;
		} else if(json["janus"] === "success") {
			// Success!
			Janus.debug("Got a success on session " + sessionId);
			Janus.debug(json);
			var transaction = json["transaction"];
			if(transaction !== null && transaction !== undefined) {
				var reportSuccess = transactions[transaction];
				if(reportSuccess !== null && reportSuccess !== undefined) {
					reportSuccess(json);
				}
				delete transactions[transaction];
			}
			return;
		} else if(json["janus"] === "trickle") {
			// We got a trickle candidate from Janus
			var sender = json["sender"];
			if(sender === undefined || sender === null) {
				Janus.warn("Missing sender...");
				return;
			}
			var pluginHandle = pluginHandles[sender];
			if(pluginHandle === undefined || pluginHandle === null) {
				Janus.debug("This handle is not attached to this session");
				return;
			}
			var candidate = json["candidate"];
			Janus.debug("Got a trickled candidate on session " + sessionId);
			Janus.debug(candidate);
			var config = pluginHandle.webrtcStuff;
			if(config.pc && config.remoteSdp) {
				// Add candidate right now
				Janus.debug("Adding remote candidate:", candidate);
				if(!candidate || candidate.completed === true) {
					// end-of-candidates
					config.pc.addIceCandidate();
				} else {
					// New candidate
					config.pc.addIceCandidate(new RTCIceCandidate(candidate));
				}
			} else {
				// We didn't do setRemoteDescription (trickle got here before the offer?)
				Janus.debug("We didn't do setRemoteDescription (trickle got here before the offer?), caching candidate");
				if(!config.candidates)
					config.candidates = [];
				config.candidates.push(candidate);
				Janus.debug(config.candidates);
			}
		} else if(json["janus"] === "webrtcup") {
			// The PeerConnection with the gateway is up! Notify this
			Janus.debug("Got a webrtcup event on session " + sessionId);
			Janus.debug(json);
			var sender = json["sender"];
			if(sender === undefined || sender === null) {
				Janus.warn("Missing sender...");
				return;
			}
			var pluginHandle = pluginHandles[sender];
			if(pluginHandle === undefined || pluginHandle === null) {
				Janus.debug("This handle is not attached to this session");
				return;
			}
			pluginHandle.webrtcState(true);
			return;
		} else if(json["janus"] === "hangup") {
			// A plugin asked the core to hangup a PeerConnection on one of our handles
			Janus.debug("Got a hangup event on session " + sessionId);
			Janus.debug(json);
			var sender = json["sender"];
			if(sender === undefined || sender === null) {
				Janus.warn("Missing sender...");
				return;
			}
			var pluginHandle = pluginHandles[sender];
			if(pluginHandle === undefined || pluginHandle === null) {
				Janus.debug("This handle is not attached to this session");
				return;
			}
			pluginHandle.webrtcState(false, json["reason"]);
			pluginHandle.hangup();
		} else if(json["janus"] === "detached") {
			// A plugin asked the core to detach one of our handles
			Janus.debug("Got a detached event on session " + sessionId);
			Janus.debug(json);
			var sender = json["sender"];
			if(sender === undefined || sender === null) {
				Janus.warn("Missing sender...");
				return;
			}
			var pluginHandle = pluginHandles[sender];
			if(pluginHandle === undefined || pluginHandle === null) {
				// Don't warn here because destroyHandle causes this situation.
				return;
			}
			pluginHandle.detached = true;
			pluginHandle.ondetached();
			pluginHandle.detach();
		} else if(json["janus"] === "media") {
			// Media started/stopped flowing
			Janus.debug("Got a media event on session " + sessionId);
			Janus.debug(json);
			var sender = json["sender"];
			if(sender === undefined || sender === null) {
				Janus.warn("Missing sender...");
				return;
			}
			var pluginHandle = pluginHandles[sender];
			if(pluginHandle === undefined || pluginHandle === null) {
				Janus.debug("This handle is not attached to this session");
				return;
			}
			pluginHandle.mediaState(json["type"], json["receiving"]);
		} else if(json["janus"] === "slowlink") {
			Janus.debug("Got a slowlink event on session " + sessionId);
			Janus.debug(json);
			// Trouble uplink or downlink
			var sender = json["sender"];
			if(sender === undefined || sender === null) {
				Janus.warn("Missing sender...");
				return;
			}
			var pluginHandle = pluginHandles[sender];
			if(pluginHandle === undefined || pluginHandle === null) {
				Janus.debug("This handle is not attached to this session");
				return;
			}
			pluginHandle.slowLink(json["uplink"], json["nacks"]);
		} else if(json["janus"] === "error") {
			// Oops, something wrong happened
			Janus.error("Ooops: " + json["error"].code + " " + json["error"].reason);	// FIXME
			Janus.debug(json);
			var transaction = json["transaction"];
			if(transaction !== null && transaction !== undefined) {
				var reportSuccess = transactions[transaction];
				if(reportSuccess !== null && reportSuccess !== undefined) {
					reportSuccess(json);
				}
				delete transactions[transaction];
			}
			return;
		} else if(json["janus"] === "event") {
			Janus.debug("Got a plugin event on session " + sessionId);
			Janus.log("Got a plugin event on session " + sessionId);
			
			Janus.debug(json);
			var sender = json["sender"];
			if(sender === undefined || sender === null) {
				Janus.warn("Missing sender...");
				return;
			}
			var plugindata = json["plugindata"];
			if(plugindata === undefined || plugindata === null) {
				Janus.warn("Missing plugindata...");
				return;
			}
			Janus.debug("  -- Event is coming from " + sender + " (" + plugindata["plugin"] + ")");
			var data = plugindata["data"];
			Janus.debug(data);
			var pluginHandle = pluginHandles[sender];
			if(pluginHandle === undefined || pluginHandle === null) {
				Janus.warn("This handle is not attached to this session");
				return;
			}
			var jsep = json["jsep"];
			if(jsep !== undefined && jsep !== null) {
				Janus.debug("Handling SDP as well...");
				Janus.debug(jsep);
			}
			var callback = pluginHandle.onmessage;
			if(callback !== null && callback !== undefined) {
				//Janus.debug("Notifying application...");
				// Send to callback specified when attaching plugin handle
				callback(data, jsep);
			} else {
				// Send to generic callback (?)
				Janus.debug("No provided notification callback");
			}
		} else {
			Janus.warn("Unknown message/event  '" + json["janus"] + "' on session " + sessionId);
			Janus.debug(json);
		}
	}

	this.customEvent = handleEvent;
	// Private helper to send keep-alive messages on WebSockets
	function keepAlive() {
		if(server === null || !websockets || !connected)
			return;
		wsKeepaliveTimeoutId = setTimeout(keepAlive, 30000);
		var request = { "janus": "keepalive", "session_id": sessionId, "transaction": Janus.randomString(12) };
		if(token !== null && token !== undefined)
			request["token"] = token;
		if(apisecret !== null && apisecret !== undefined)
			request["apisecret"] = apisecret;
		ws.send(JSON.stringify(request));
	}

	// Private method to create a session
	function createSession(callbacks) {
		var transaction = Janus.randomString(12);
		var request = { "janus": "create", "transaction": transaction };
		if(token !== null && token !== undefined)
			request["token"] = token;
		if(apisecret !== null && apisecret !== undefined)
			request["apisecret"] = apisecret;
		if(server === null && Janus.isArray(servers)) {
			// We still need to find a working server from the list we were given
			server = servers[serversIndex];
			if(server.indexOf("ws") === 0) {
				websockets = true;
				Janus.log("Server #" + (serversIndex+1) + ": trying WebSockets to contact Janus (" + server + ")");
			} else {
				websockets = false;
				Janus.log("Server #" + (serversIndex+1) + ": trying REST API to contact Janus (" + server + ")");
			}
		}
		Janus.httpAPICall(server, {
			verb: 'POST',
			withCredentials: withCredentials,
			body: request,
			success: function(json) {
				Janus.debug(json);
				if(json["janus"] !== "success") {
					Janus.error("Ooops: " + json["error"].code + " " + json["error"].reason);	// FIXME
					callbacks.error(json["error"].reason);
					return;
				}
				connected = true;
				sessionId = json.data["id"];
				Janus.log("Created session: " + sessionId);
				Janus.sessions[sessionId] = that;
				eventHandler();
				callbacks.success();
			},
			error: function(textStatus, errorThrown) {
				Janus.error(textStatus + ":", errorThrown);	// FIXME
				if(Janus.isArray(servers)) {
					serversIndex++;
					if(serversIndex == servers.length) {
						// We tried all the servers the user gave us and they all failed
						callbacks.error("Error connecting to any of the provided Janus servers: Is the gateway down?");
						return;
					}
					// Let's try the next server
					server = null;
					setTimeout(function() { createSession(callbacks); }, 200);
					return;
				}
				if(errorThrown === "")
					callbacks.error(textStatus + ": Is the gateway down?");
				else
					callbacks.error(textStatus + ": " + errorThrown);
			}
		});
	}

	// Private method to destroy a session
	function destroySession(callbacks) {
		callbacks = callbacks || {};
		// FIXME This method triggers a success even when we fail
		callbacks.success = (typeof callbacks.success == "function") ? callbacks.success : Janus.noop;
		var asyncRequest = true;
		if(callbacks.asyncRequest !== undefined && callbacks.asyncRequest !== null)
			asyncRequest = (callbacks.asyncRequest === true);
		var notifyDestroyed = true;
		if(callbacks.notifyDestroyed !== undefined && callbacks.notifyDestroyed !== null)
			notifyDestroyed = (callbacks.notifyDestroyed === true);
		Janus.log("Destroying session " + sessionId + " (async=" + asyncRequest + ")");
		if(!connected) {
			Janus.warn("Is the gateway down? (connected=false)");
			callbacks.success();
			return;
		}
		if(sessionId === undefined || sessionId === null) {
			Janus.warn("No session to destroy");
			callbacks.success();
			if(notifyDestroyed)
				gatewayCallbacks.destroyed();
			return;
		}
		delete Janus.sessions[sessionId];
		// No need to destroy all handles first, Janus will do that itself
		var request = { "janus": "destroy", "transaction": Janus.randomString(12) };
		if(token !== null && token !== undefined)
			request["token"] = token;
		if(apisecret !== null && apisecret !== undefined)
			request["apisecret"] = apisecret;
		
		Janus.httpAPICall(server + "/" + sessionId, {
			verb: 'POST',
			async: asyncRequest,	// Sometimes we need false here, or destroying in onbeforeunload won't work
			withCredentials: withCredentials,
			body: request,
			success: function(json) {
				Janus.log("Destroyed session:");
				Janus.debug(json);
				sessionId = null;
				connected = false;
				if(json["janus"] !== "success") {
					Janus.error("Ooops: " + json["error"].code + " " + json["error"].reason);	// FIXME
				}
				callbacks.success();
				if(notifyDestroyed)
					gatewayCallbacks.destroyed();
			},
			error: function(textStatus, errorThrown) {
				Janus.error(textStatus + ":", errorThrown);	// FIXME
				// Reset everything anyway
				sessionId = null;
				connected = false;
				callbacks.success();
				if(notifyDestroyed)
					gatewayCallbacks.destroyed();
			}
		});
	}

	// Private method to create a plugin handle
	function createHandle(callbacks) {
		callbacks = callbacks || {};
		callbacks.success = (typeof callbacks.success == "function") ? callbacks.success : Janus.noop;
		callbacks.error = (typeof callbacks.error == "function") ? callbacks.error : Janus.noop;
		callbacks.consentDialog = (typeof callbacks.consentDialog == "function") ? callbacks.consentDialog : Janus.noop;
		callbacks.iceState = (typeof callbacks.iceState == "function") ? callbacks.iceState : Janus.noop;
		callbacks.mediaState = (typeof callbacks.mediaState == "function") ? callbacks.mediaState : Janus.noop;
		callbacks.webrtcState = (typeof callbacks.webrtcState == "function") ? callbacks.webrtcState : Janus.noop;
		callbacks.slowLink = (typeof callbacks.slowLink == "function") ? callbacks.slowLink : Janus.noop;
		callbacks.onmessage = (typeof callbacks.onmessage == "function") ? callbacks.onmessage : Janus.noop;
		callbacks.onlocalstream = (typeof callbacks.onlocalstream == "function") ? callbacks.onlocalstream : Janus.noop;
		callbacks.onremotestream = (typeof callbacks.onremotestream == "function") ? callbacks.onremotestream : Janus.noop;
		callbacks.ondata = (typeof callbacks.ondata == "function") ? callbacks.ondata : Janus.noop;
		callbacks.ondataopen = (typeof callbacks.ondataopen == "function") ? callbacks.ondataopen : Janus.noop;
		callbacks.oncleanup = (typeof callbacks.oncleanup == "function") ? callbacks.oncleanup : Janus.noop;
		callbacks.ondetached = (typeof callbacks.ondetached == "function") ? callbacks.ondetached : Janus.noop;
		if(!connected) {
			Janus.warn("Is the gateway down? (connected=false)");
			callbacks.error("Is the gateway down? (connected=false)");
			return;
		}
		var plugin = callbacks.plugin;
		if(plugin === undefined || plugin === null) {
			Janus.error("Invalid plugin");
			callbacks.error("Invalid plugin");
			return;
		}
		var opaqueId = callbacks.opaqueId;
		var handleToken = callbacks.token ? callbacks.token : token;
		var transaction = Janus.randomString(12);
		var request = { "janus": "attach", "plugin": plugin, "opaque_id": opaqueId, "transaction": transaction };
		if(handleToken !== null && handleToken !== undefined)
			request["token"] = handleToken;
		if(apisecret !== null && apisecret !== undefined)
			request["apisecret"] = apisecret;
		Janus.httpAPICall(server + "/" + sessionId, {
			verb: 'POST',
			withCredentials: withCredentials,
			body: request,
			success: function(json) {
				Janus.debug(json);
				if(json["janus"] !== "success") {
					Janus.error("Ooops: " + json["error"].code + " " + json["error"].reason);	// FIXME
					callbacks.error("Ooops: " + json["error"].code + " " + json["error"].reason);
					return;
				}
				var handleId = json.data["id"];
				Janus.log("Created handle: " + handleId);
				var pluginHandle =
					{
						session : that,
						plugin : plugin,
						id : handleId,
						token : handleToken,
						detached : false,
						webrtcStuff : {
							started : false,
							myStream : null,
							streamExternal : false,
							remoteStream : null,
							mySdp : null,
							mediaConstraints : null,
							pc : null,
							dataChannel : null,
							dtmfSender : null,
							trickle : true,
							iceDone : false,
							volume : {
								value : null,
								timer : null
							},
							bitrate : {
								value : null,
								bsnow : null,
								bsbefore : null,
								tsnow : null,
								tsbefore : null,
								timer : null
							}
						},
						getId : function() { return handleId; },
						getPlugin : function() { return plugin; },
						getVolume : function() { return getVolume(handleId); },
						isAudioMuted : function() { return isMuted(handleId, false); },
						muteAudio : function() { return mute(handleId, false, true); },
						unmuteAudio : function() { return mute(handleId, false, false); },
						isVideoMuted : function() { return isMuted(handleId, true); },
						muteVideo : function() { return mute(handleId, true, true); },
						unmuteVideo : function() { return mute(handleId, true, false); },
						getBitrate : function() { return getBitrate(handleId); },
						send : function(callbacks) { sendMessage(handleId, callbacks); },
						data : function(callbacks) { sendData(handleId, callbacks); },
						dtmf : function(callbacks) { sendDtmf(handleId, callbacks); },
						consentDialog : callbacks.consentDialog,
						iceState : callbacks.iceState,
						mediaState : callbacks.mediaState,
						webrtcState : callbacks.webrtcState,
						slowLink : callbacks.slowLink,
						onmessage : callbacks.onmessage,
						createOffer : function(callbacks) { prepareWebrtc(handleId, callbacks); },
						createAnswer : function(callbacks) { prepareWebrtc(handleId, callbacks); },
						handleRemoteJsep : function(callbacks) { prepareWebrtcPeer(handleId, callbacks); },
						onlocalstream : callbacks.onlocalstream,
						onremotestream : callbacks.onremotestream,
						ondata : callbacks.ondata,
						ondataopen : callbacks.ondataopen,
						oncleanup : callbacks.oncleanup,
						ondetached : callbacks.ondetached,
						hangup : function(sendRequest) { cleanupWebrtc(handleId, sendRequest === true); },
						detach : function(callbacks) { destroyHandle(handleId, callbacks); }
					}
				pluginHandles[handleId] = pluginHandle;
				callbacks.success(pluginHandle);
			},
			error: function(textStatus, errorThrown) {
				Janus.error(textStatus + ":", errorThrown);	// FIXME
			}
		});
	}

	// Private method to send a message
	function sendMessage(handleId, callbacks) {
		callbacks = callbacks || {};
		callbacks.success = (typeof callbacks.success == "function") ? callbacks.success : Janus.noop;
		callbacks.error = (typeof callbacks.error == "function") ? callbacks.error : Janus.noop;
		if(!connected) {
			Janus.warn("Is the gateway down? (connected=false)");
			callbacks.error("Is the gateway down? (connected=false)");
			return;
		}
		var pluginHandle = pluginHandles[handleId];
		if(pluginHandle === null || pluginHandle === undefined ||
				pluginHandle.webrtcStuff === null || pluginHandle.webrtcStuff === undefined) {
			Janus.warn("Invalid handle");
			callbacks.error("Invalid handle");
			return;
		}
		var message = callbacks.message;
		var jsep = callbacks.jsep;
		var transaction = Janus.randomString(12);
		var request = { "janus": "message", "body": message, "transaction": transaction };
		if(pluginHandle.token !== null && pluginHandle.token !== undefined)
			request["token"] = pluginHandle.token;
		if(apisecret !== null && apisecret !== undefined)
			request["apisecret"] = apisecret;
		if(jsep !== null && jsep !== undefined)
			request.jsep = jsep;
		Janus.debug("Sending message to plugin (handle=" + handleId + "):");
		Janus.debug(request);
		Janus.httpAPICall(server + "/" + sessionId + "/" + handleId, {
			verb: 'POST',
			withCredentials: withCredentials,
			body: request,
			success: function(json) {
				Janus.debug("Message sent!");
				Janus.debug(json);
				if(json["janus"] === "success") {
					// We got a success, must have been a synchronous transaction
					var plugindata = json["plugindata"];
					if(plugindata === undefined || plugindata === null) {
						Janus.warn("Request succeeded, but missing plugindata...");
						callbacks.success();
						return;
					}
					Janus.log("Synchronous transaction successful (" + plugindata["plugin"] + ")");
					var data = plugindata["data"];
					Janus.debug(data);
					callbacks.success(data);
					return;
				} else if(json["janus"] !== "ack") {
					// Not a success and not an ack, must be an error
					if(json["error"] !== undefined && json["error"] !== null) {
						Janus.error("Ooops: " + json["error"].code + " " + json["error"].reason);	// FIXME
						callbacks.error(json["error"].code + " " + json["error"].reason);
					} else {
						Janus.error("Unknown error");	// FIXME
						callbacks.error("Unknown error");
					}
					return;
				}
				// If we got here, the plugin decided to handle the request asynchronously
				
				Janus.log(callbacks.success)
				callbacks.success();
			},
			error: function(textStatus, errorThrown) {
				Janus.error(textStatus + ":", errorThrown);	// FIXME
				callbacks.error(textStatus + ": " + errorThrown);
			}
		});
	}

	// Private method to destroy a plugin handle
	function destroyHandle(handleId, callbacks) {
		callbacks = callbacks || {};
		callbacks.success = (typeof callbacks.success == "function") ? callbacks.success : Janus.noop;
		callbacks.error = (typeof callbacks.error == "function") ? callbacks.error : Janus.noop;
		var asyncRequest = true;
		if(callbacks.asyncRequest !== undefined && callbacks.asyncRequest !== null)
			asyncRequest = (callbacks.asyncRequest === true);
		Janus.log("Destroying handle " + handleId + " (async=" + asyncRequest + ")");
		var pluginHandle = pluginHandles[handleId];
		if(pluginHandle === null || pluginHandle === undefined || pluginHandle.detached) {
			// Plugin was already detached by Janus, calling detach again will return a handle not found error, so just exit here
			delete pluginHandles[handleId];
			callbacks.success();
			return;
		}
		if(!connected) {
			Janus.warn("Is the gateway down? (connected=false)");
			callbacks.error("Is the gateway down? (connected=false)");
			return;
		}
		var request = { "janus": "detach", "transaction": Janus.randomString(12) };
		if(pluginHandle.token !== null && pluginHandle.token !== undefined)
			request["token"] = pluginHandle.token;
		if(apisecret !== null && apisecret !== undefined)
			request["apisecret"] = apisecret;

		Janus.httpAPICall(server + "/" + sessionId + "/" + handleId, {
			verb: 'POST',
			async: asyncRequest,	// Sometimes we need false here, or destroying in onbeforeunload won't work
			withCredentials: withCredentials,
			body: request,
			success: function(json) {
				Janus.log("Destroyed handle:");
				Janus.debug(json);
				if(json["janus"] !== "success") {
					Janus.error("Ooops: " + json["error"].code + " " + json["error"].reason);	// FIXME
				}
				delete pluginHandles[handleId];
				callbacks.success();
			},
			error: function(textStatus, errorThrown) {
				Janus.error(textStatus + ":", errorThrown);	// FIXME
				// We cleanup anyway
				delete pluginHandles[handleId];
				callbacks.success();
			}
		});
	}
};
media.create = (gatewayCallbacks) => {
	return new Janus(gatewayCallbacks)
}

module.exports = media