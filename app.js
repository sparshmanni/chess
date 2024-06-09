const express = require('express');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io');
const { Chess } = require('chess.js');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let games = {}; 
let users = {}; 

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.render('index');
});

io.on('connection', (socket) => {
    console.log('A user connected', socket.id);

    socket.on('joinGame', (gameId, userName) => {
        if (!games[gameId]) {
            games[gameId] = {
                chess: new Chess(),
                players: {
                    white: null,
                    black: null,
                },
                spectators: [],
            };
        }

        let game = games[gameId];
        let playerRole = null;

       
        if (game.players.white && game.players.white.id === socket.id) {
            playerRole = 'w';
            socket.emit('playerRole', 'w');
        } else if (game.players.black && game.players.black.id === socket.id) {
            playerRole = 'b';
            socket.emit('playerRole', 'b');
        } else if (!game.players.white) {
            game.players.white = { id: socket.id, name: userName };
            playerRole = 'w';
            socket.emit('playerRole', 'w');
        } else if (!game.players.black) {
            game.players.black = { id: socket.id, name: userName };
            playerRole = 'b';
            socket.emit('playerRole', 'b');
        } else {
            game.spectators.push({ id: socket.id, name: userName });
            socket.emit('spectatorRole');
        }

        users[socket.id] = { gameId, userName };

        socket.join(gameId);
        io.to(gameId).emit('boardState', game.chess.fen());

   
        if (playerRole === 'w') {
            socket.emit('message', 'Waiting for opponent...');
        } else if (playerRole === 'b') {
            socket.emit('message', `Joined game with opponent: ${game.players.white.name}`);
            io.to(game.players.white.id).emit('message', `Opponent joined: ${userName}`);
        } else if (playerRole === 'w' || playerRole === 'b') {
            // New player joins
            const opponentName = playerRole === 'w' ? game.players.black.name : game.players.white.name;
            io.to(gameId).emit('message', `${userName} joined the game with opponent: ${opponentName}`);
        } else {
            // Spectator joins
            io.to(gameId).emit('message', `Spectator joined: ${userName}`);
        }
    });


    socket.on('move', (move) => {
        let user = users[socket.id];
        if (!user) return;
    
        let game = games[user.gameId];
        if (!game) return;
    
        let chess = game.chess;
        if ((chess.turn() === 'w' && game.players.white?.id === socket.id) ||
            (chess.turn() === 'b' && game.players.black?.id === socket.id)) {

            try {
                const result = chess.move(move);
                if (result) {
                    io.to(user.gameId).emit('move', move);
                    io.to(user.gameId).emit('boardState', chess.fen());
                } else {
                    socket.emit('invalidMove', move);
                }
            } catch (error) {
                console.error(`Invalid move attempted: ${error.message}`);
                socket.emit('invalidMove', move);
            }
        }
    });

    const isPlayerAlreadyJoined = (game, playerId) => {
        return game.players.white && game.players.white.id === playerId ||
               game.players.black && game.players.black.id === playerId;
    };

    socket.on('disconnect', () => {
        let user = users[socket.id];
        if (!user) return;

        let game = games[user.gameId];
        if (!game) return;

        if (game.players.white && game.players.white.id === socket.id) {
            game.players.white = null;
        } else if (game.players.black && game.players.black.id === socket.id) {
            game.players.black = null;
        } else {
            game.spectators = game.spectators.filter(player => player.id !== socket.id);
        }

        if (!game.players.white && !game.players.black && game.spectators.length === 0) {
            delete games[user.gameId];
        }

        delete users[socket.id];
        console.log('A user disconnected', socket.id);
    });
});



server.listen(3000, () => {
    console.log('Server is running on port 3000');
});
