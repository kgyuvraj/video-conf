const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const activePeers = {};

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000", 
    methods: ["GET", "POST"]
  }
});

const port = process.env.PORT || 3001;
const rooms = {};

app.use(express.json());

app.get('/getMessages', (req, res) => {
  const room_id = req.query.room_id;
  if (rooms[room_id]) {
    const roomMessages = rooms[room_id].messages;
    res.json(roomMessages || []);
  } else {
    res.json([]);
  }
});

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('joinRoom', (room_id) => {
    socket.join(room_id);
    const roomClients = io.sockets.adapter.rooms.get(room_id);

    if (roomClients.size >= 2) {
      io.to(room_id).emit('roomReady');
    }

    if (!rooms[room_id]) {
      rooms[room_id] = { messages: [], peers: {} };
    }
    socket.emit('initMessages', rooms[room_id].messages);

    
    socket.on('startCall', () => {
      if (!activePeers[room_id]) {
        activePeers[room_id] = {};
      }

      activePeers[room_id][socket.id] = socket;


      socket.on('offer', (data) => {
        const { targetSocketId, offer } = data;
        const targetSocket = activePeers[room_id][targetSocketId];
        if (targetSocket) {
          targetSocket.emit('offer', { senderSocketId: socket.id, offer });
        }
      });


      socket.on('answer', (data) => {
        const { targetSocketId, answer } = data;
        const targetSocket = activePeers[room_id][targetSocketId];
        if (targetSocket) {
          targetSocket.emit('answer', { senderSocketId: socket.id, answer });
        }
      });


      socket.on('iceCandidate', (data) => {
        const { targetSocketId, candidate } = data;
        const targetSocket = activePeers[room_id][targetSocketId];
        if (targetSocket) {
          targetSocket.emit('iceCandidate', { senderSocketId: socket.id, candidate });
        }
      });
    });


    socket.on('sendMessage', (data) => {
      const { room_id, message } = data;
      if (rooms[room_id]) {
        rooms[room_id].messages.push(message);
        io.to(room_id).emit('newMessage', message);
      }
    });

    socket.on('disconnect', () => {
      console.log('A user disconnected');
      for (const room_id in rooms) {
        if (rooms[room_id].peers[socket.id]) {
          delete rooms[room_id].peers[socket.id];
        }
      }
    });
  });
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
