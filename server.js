const os = require('os');

const dotenv = require('dotenv');
const express = require('express');
const expressWs = require('express-ws');
const { v4: uuidv4 } = require('uuid');
const { WebSocket } = require('ws');


dotenv.config();

const IP = os.networkInterfaces().Ethernet?.[0] ?? os.networkInterfaces()['Wi-Fi'][1].address;
const DEBUG = false;
const debug = (text) => { if (DEBUG) {console.log(text);} }

const app = express();
const wsServer = expressWs(app);

let clients = {};

// COMMON STARTS 
const MESSAGE_TYPES = {
    GREET: 'GREET',
    GRANT_IDENTIFIER: 'GRANT_IDENTIFIER',
    TEXT: 'TEXT',
    BROADCAST: 'BROADCAST',
};

const sendJson = (ws, json) => (ws.send(JSON.stringify(json)));

const receiveJson = (message) => {
    let received;
    try {
        received = JSON.parse(message);
    } catch (e) {
        if (e.name === 'SyntaxError') {
            console.log('failed to parse received data as JSON: bad format');
        }
    }
    return received;
};

const buildMessage = (messageType, messageObject) => ({
    messageType,
    ...messageObject
});

const sendBroadcast = (ws, data) => {
    Object.keys(clients).forEach((clientUuid) => {
        if (data.id !== clientUuid) { //everyone but the emissor
            sendMessage(clients[clientUuid], MESSAGE_TYPES.BROADCAST, { broadcast: data.broadcast, id: data.id});
        }
    });
}

const handleMessage = (ws, req, data) => {
    debug(data);
    switch(data.messageType) {
        case MESSAGE_TYPES.GREET:
            const id = uuidv4();
            clients[id] = ws;
            sendGrantedIdentifier(ws, id);
            break;
        case MESSAGE_TYPES.TEXT:
            console.log(`user ${data.id} says: ${data.text}`);
            break;
        case MESSAGE_TYPES.BROADCAST:
            console.log(`user ${data.id} broadcasts: ${data.broadcast}`);
            sendBroadcast(ws, data);
            break;
        case MESSAGE_TYPES.TEXT:
            console.log(`user ${data.id} sends text message to ${data.destination}, says: ${data.text}`);
            sendMessage(ws, data);
            break;
    }
};

const sendMessage = (ws, messageType, messageObject) => {
    sendJson(ws, buildMessage(messageType, messageObject));
}

// COMMON ENDS

const sendGrantedIdentifier = (ws, id) => {
    sendMessage(ws, MESSAGE_TYPES.GRANT_IDENTIFIER, { id });
};

const checkGreeting = (data) => {
    const currentUuids = Object.keys(clients);
    return !currentUuids.includes(data.id);
}

// routing
app.ws('/', (ws, req) => {
    console.log('client connects');
    ws.on('message', (message) => {
        const data = receiveJson(message);
        if (data) {
            handleMessage(ws, req, data);
        }
    });

    ws.on('close', () => {
        clients = {};
    })

});


app.listen(process.env.PORT, () => { console.log(`ws server listening at ${IP}:${process.env.PORT}`); });