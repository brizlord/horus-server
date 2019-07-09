var app = require('express')();
var cors = require('cors');
var server = require('http').Server(app);
var io = require('socket.io')(server);
var findDevices = require('local-devices');
var Nipca = require('nipca');

var usersCxed = [];
//
// var usersCxed = [{
//     id: '28:10:7B:0D:40:4B'.split(':').join(''),
//     nick: 'D-Link DCS-932L',
//     protocol: 'http://',
//     ip: '10.2.98.171',
//     method: '/video.cgi',
//     type: 'ip-camera',
//     tag: 'img',
//     user: 'admin',
//     pass: 'Password',
//     uri: '?user=admin&password=Password&channel=0&.mjpg'
// }];

// new Nipca(usersCxed[0].protocol + usersCxed[0].ip)
//     .login(usersCxed[0].user, usersCxed[0].pass)
//     .then(nipcaClient => {
//         nipcaClient.fetchInfo().then(res => console.log("fetchInfo:", res));
//     })
//     .catch(err => console.error("Error", err));


app.use(cors());

server.listen(3001);

io.on('connection', function (socket) {

    socket.emit('cxedUsers', {users: usersCxed});
    socket.on('idUsers', function (data) {
        var exist = false;

        for (let i of usersCxed) {
            if (i.wstrack == this.id) {
                exist = true;
				i.batteryStatus=data.data.batteryStatus;
            }
        }

        if (!exist) {
            data.data.wstrack = socket.id;
            usersCxed.push(data.data);
            io.sockets.connected[socket.id].emit("myId", this.id);
            console.log('Usuario ' + data.data.nick + '--' + data.data.id + "-> " + this.id + ' se ha conectado.');
            socket.emit('cxedUsers', {users: usersCxed});
        } else {
            socket.emit('cxedUsers', {users: usersCxed});
        }
    });

    socket.on('sendStream', function (data) {
        if (data.data.sendTo.length > 0) {
            for (let c of data.data.sendTo) {
                if (findingUserCxed(c.wstrack)) {
                    if (io.sockets.connected.hasOwnProperty(c.wstrack))
                        io.sockets.connected[c.wstrack].emit("getStream", {
                            stream: data.data.stream,
                            id: data.data.sender.id
                        });
                } else {
                    io.sockets.connected[data.data.sender.wstrack].emit("unsubscribeStream", {receiver: c});
                }
            }
        } else {
            console.log('unsubscribeStream EVENT');
            io.sockets.connected[data.data.sender.wstrack].emit("unsubscribeStream", {});
        }
    });

    socket.on('toolsSelector', function (data) {
        if (io.sockets.connected[data.data.sendTo.wstrack])
            io.sockets.connected[data.data.sendTo.wstrack].emit("selectorOp", data.data.ops);
    });

    socket.on('requestCall', function (data) {
        try {
            io.sockets.connected[data.data.sendTo.wstrack].emit("newCall", {from: data.data.sender});
        } catch (e) {
            io.sockets.connected[data.data.sender.wstrack].emit("refusedCall", {
                to: data.data.sendTo,
                mssg: e.toString()
            });
        }
    });

    socket.on('refuseCall', function (data) {

    });

    socket.on('closeCx', function (data) {
        for (let peer of data.data) {
            io.sockets.connected[peer.wstrack].emit("closedCx", 'close conections');
        }
    });

    socket.on('cancelSubscription', function (data) {
        let clients = Object.keys(io.sockets.connected);

        if (data.data.sender != null && clients.indexOf(data.data.sender.wstrack) >= 0) {
            io.sockets.connected[data.data.sender.wstrack].emit("unsubscribeStream", {receiver: data.data.reciever});
        } else {
            io.sockets.connected[data.data.reciever.wstrack].emit("closedCx", 'close conections');
        }
    });

    var checkUsers = setInterval(() => {
        let clients = Object.keys(io.sockets.connected);
        for (let i = 0; i < usersCxed.length; i++) {
            let index = clients.indexOf(usersCxed[i].wstrack);
            if (index < 0 && usersCxed[i].type != 'ip-camera') {
                usersCxed.splice(index, 1);
            }
        }

        if (usersCxed.length == 0) {

        }
    }, 2000);

    var checkDevices = setInterval(() => {
        findDevices()
            .then(devices => {
                // console.log(devices);
            });
    }, 2000);

    function findingUserCxed(wstrack) {
        let clients = Object.keys(io.sockets.connected);

        return (clients.filter(i => {
            return i === wstrack;
        }).length > 0) ? true : false;
    }
});
