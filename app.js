const {response} = require("express");
const express = require("express");
const socket = require("socket.io");

// App setup
const PORT = 3000;
const app = express();
const server = app.listen(PORT, function () {
    console.log(`Listening on port ${PORT}`);
    console.log(`http://127.0.0.1:${PORT}`);
});

app.get('/', function (req, res) {
    res.send('hello world')
})


// Socket setup
const io = socket(server);
const activeUsers = new Set();
const messagesId = new Set();
const lastMessages = [];
// let isLive = false;
const version = 6;

function makeId(length) {
    let result = '';
    let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() *
            charactersLength));
    }
    return result;
}

function add_message_id(socketId, name, message, replayTo) {
    let i = makeId(10);
    while (lastMessages.length > 100)
        lastMessages.splice(0, 1);
    while (true) {
        if (!messagesId.has(i)) {
            messagesId.add(i);
            lastMessages.push({
                "senderId": socketId,
                "messageId": i,
                "name": name,
                "message": message,
                "replayTo": replayTo
            })
            return i;
        }
        i = makeId(10);
    }
}

function update_message_sender(socketId, oldSenderId) {
    lastMessages.forEach(function (item, index, object) {
        if (item['senderId'] == oldSenderId)
            item['senderId'] = socketId;
    });
}

function update_message_name(socketId, newName) {
    lastMessages.forEach(function (item, index, object) {
        if (item['senderId'] == socketId)
            item['name'] = newName;
    });
}

function remove_message(socketId, messageId) {

    console.log(socketId);
    console.log(messageId);
    let res = false;
    lastMessages.forEach(function (item, index, object) {
        console.log(item);
        let sendId = socketId == item['senderId'];
        let mesId = messageId == item['messageId'];
        if (sendId && mesId) {
            object.splice(index, 1);
            res = true;
        }
    });
    return res;
}


io.on("connection", function (socket) {
    console.log("Made socket connection");
    activeUsers.add(socket.id);
    console.log(activeUsers.size);
    let userInfo = {}
    userInfo['id'] = socket.id;
    userInfo['version'] = version;
    socket.emit('get_id', socket.id);
    socket.emit('get_Data', userInfo);

    socket.on("updateSenderId", function (data) {
        socket.emit('getVersion', version);
        update_message_sender(socket.id, data['oldSenderId']);
        socket.emit('getMessages', lastMessages);
        data["newSenderId"] = socket.id;
        io.emit("updateSenderId", data);
    });
    socket.on("updateSenderName", function (data) {
        update_message_name(socket.id, data['newName']);
        data['senderId'] = socket.id;
        io.emit('updateSenderName', data);
    });
    socket.on("updateOldMessages", function (data) {
        update_message_sender(socket.id, data['oldSenderId']);
        socket.emit('getMessages', lastMessages);
    });
    io.emit("changeUser", activeUsers.size);

    socket.on("sendLocation", function (data) {
        data['user_id'] = socket.id;
        io.emit("getLocation", data);
    });

    socket.on("sendMessage", function (data) {
        data["senderId"] = socket.id;
        data["messageId"] = add_message_id(socket.id, data['name'], data['message'], data['replayTo']);
        io.emit("getMessage", data);
    });

    socket.on("removeMessage", function (data) {
        console.log(data);
        let res = remove_message(socket.id, data['messageId']);
        console.log(res);
        if (res)
            io.emit("removeMessage", data);
    });

    socket.on("stopBroadcast", function () {
        response['user_id'] = socket.id;
        io.emit("userStopBroadcast", response);
    });

    socket.on("disconnect", () => {
        activeUsers.delete(socket.id);
        io.emit("changeUser", activeUsers.size);
        console.log(socket.id);
    });

});
