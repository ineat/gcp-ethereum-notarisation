var express = require('express');

/* To serve web3 index.html file */

var app = express();
app.use('/', express.static(__dirname + '/'));

app.get('/', function(request, response){
	response.sendFile('index.html', {root: __dirname });
});

app.listen(3000, () => {
  console.log("Server started on port 3000");
});


/* Websocket that computes hash for a given content */

var WebSocketServer = require("ws").Server;
var ws = new WebSocketServer( { port: 8100 } );

console.log("Websocket started on port 8100");

ws.on('connection', function (ws) {
  console.log("Socket connected");

  ws.on("message", function (str) {
        var hash = require("crypto").createHash('sha256').update(str).digest().toString("hex");
        console.log("hash : "+hash);
        ws.send(hash);
    })

    ws.on("close", function() {
        console.log("Socket closed");
    })
});