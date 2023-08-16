import './App.css';
import Peer from 'peerjs';
import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

var room_id;
var getUserMedia =
  navigator.getUserMedia ||
  navigator.webkitGetUserMedia ||
  navigator.mozGetUserMedia;
var local_stream;
var peer = null;
var currentPeer = null;

function App() {
  const [roomId, setRoomId] = useState("");
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);
  const [isCallOngoing, setIsCallOngoing] = useState(false);
  const [isCallEnded, setIsCallEnded] = useState(false); 
  const [messageInput, setMessageInput] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [socket, setSocket] = useState(null);
  const [isLocalVideoPaused, setIsLocalVideoPaused] = useState(false);
  const [isMicrophonePaused, setIsMicrophonePaused] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [peerConnection, setPeerConnection] = useState(null);

  function createRoom(roomId) {
    console.log("Creating Room");
    if (roomId === "" || roomId.trim() === "") {
      alert("Please enter room number");
      return;
    }
    room_id = roomId;
    peer = new Peer(room_id);
    peer.on("open", (id) => {
      console.log("Peer Connected with ID: ", id);
      getUserMedia(
        { video: true, audio: true },
        (stream) => {
          local_stream = stream;
          setLocalStream(local_stream);
        },
        (err) => {
          console.log(err);
        }
      );
    });
    peer.on("call", (call) => {
      call.answer(local_stream);
      call.on("stream", (stream) => {
        setRemoteStream(stream);
      });
      currentPeer = call;
    });
    socket.emit('joinRoom', room_id);
    setHasJoinedRoom(true);
    setIsCallOngoing(true);
  }

  function setLocalStream(stream) {
    let video = document.getElementById("local-video");
    video.srcObject = stream;
    video.muted = true;
    video.onloadedmetadata = () => {
      try {
        video.play();
      } catch (error) {
        console.log("Play error:", error);
      }
    };

    if (isLocalVideoPaused) {
      stream.getVideoTracks().forEach((track) => {
        track.enabled = false;
      });
    }
  }

  function toggleLocalVideo() {
    setIsLocalVideoPaused(!isLocalVideoPaused);
    local_stream.getVideoTracks().forEach((track) => {
      track.enabled = !isLocalVideoPaused;
    });
  }

  function setRemoteStream(stream) {
    let video = document.getElementById("remote-video");
    video.srcObject = stream;
    video.onloadedmetadata = () => {
      try {
        video.play();
      } catch (error) {
        console.log("Play error:", error);
      }
    };
  }

  function joinRoom(roomId) {
    console.log("Joining Room");
    if (roomId === "" || roomId.trim() === "") {
      alert("Please enter room number");
      return;
    }
    room_id = roomId;
    peer = new Peer();
    peer.on("open", (id) => {
      console.log("Connected with Id: " + id);
      getUserMedia(
        { video: true, audio: true },
        (stream) => {
          local_stream = stream;
          setLocalStream(local_stream);
          let call = peer.call(room_id, stream);
          call.on("stream", (stream) => {
            setRemoteStream(stream);
          });
          currentPeer = call;
        },
        (err) => {
          console.log(err);
        }
      );
    });
    socket.emit('joinRoom', room_id);
    setHasJoinedRoom(true);
    setIsCallOngoing(true);
  }

  function toggleMicrophone() {
    setIsMicrophonePaused(!isMicrophonePaused);
    local_stream.getAudioTracks().forEach((track) => {
      track.enabled = !isMicrophonePaused;
    });
  }

  function startScreenSharing() {
    if (isScreenSharing) {
      // Stopping screen sharing
      local_stream.getTracks().forEach((track) => track.stop());
      getUserMedia(
        { video: true, audio: true },
        (stream) => {
          local_stream = stream;
          setLocalStream(local_stream);

          const call = peer.call(room_id, stream);
          call.on("stream", (stream) => {
            setRemoteStream(stream);
          });
          currentPeer = call;
        },
        (err) => {
          console.log(err);
        }
      );
      setIsScreenSharing(false);
    } else {
      // Starting screen sharing
      navigator.mediaDevices
        .getDisplayMedia({ video: true, audio: true })
        .then((stream) => {
          local_stream.getTracks().forEach((track) => track.stop());
          local_stream = stream;
          setLocalStream(local_stream);

          const call = peer.call(room_id, local_stream);
          call.on("stream", (stream) => {
            setRemoteStream(stream);
          });
          currentPeer = call;
        })
        .catch((error) => {
          console.error("Error starting screen sharing:", error);
        });
      setIsScreenSharing(true);
    }
  }
  
  function sendChatMessage(message) {
    if (socket && room_id && messageInput.trim() !== "") { 
      const messageObj = {
        // sender: room_id,
        text: messageInput,
        timestamp: new Date().toLocaleTimeString(),
      };
      socket.emit('sendMessage', { room_id, message: messageObj });
      setMessageInput(''); 
    }
  }

function endCall() {
  if (currentPeer) {
    currentPeer.close(); 
  }

  if (local_stream) {
    local_stream.getTracks().forEach((track) => track.stop()); 
  }

  if (isScreenSharing) {
    local_stream.getTracks().forEach((track) => track.stop());
  }
  
  setIsCallOngoing(false); 
  setIsCallEnded(true); 
  setRoomId(""); 
  setChatMessages([]); 
  setHasJoinedRoom(false); 

  let remoteVideo = document.getElementById("remote-video");
  remoteVideo.srcObject = null;
  // remoteVideo.poster = "";

  let localVideo = document.getElementById("local-video");
  localVideo.srcObject = null;
  localVideo.pause();
}

  useEffect(() => {
    const socket = io('http://localhost:3001'); 
    setSocket(socket);

    socket.on('initMessages', (initMessages) => {
      setChatMessages(initMessages);
    });

    socket.on('newMessage', (message) => {
      setChatMessages((prevMessages) => [...prevMessages, message]);
    });

    socket.on('roomReady', () => {
      setHasJoinedRoom(true);
    });

    return () => {
      socket.disconnect();
    };

    getUserMedia(
      { video: true, audio: true },
      (stream) => {
        local_stream = stream;
        setLocalStream(local_stream);
  
        if (isMicrophonePaused) {
          stream.getAudioTracks().forEach((track) => {
            track.enabled = false; 
          });
        }
      },
      (err) => {
        console.log(err);
      }
    );
    if (local_stream) {
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun.example.com:3478' }, 
          { urls: 'stun:stun.services.mozilla.com' }, 
        ],
      });

      local_stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, local_stream);
      });

      peerConnection.createOffer()
        .then((offer) => {
          return peerConnection.setLocalDescription(offer);
        })
        .then(() => {
          socket.emit('offer', peerConnection.localDescription);
        });

      socket.on('offer', (offer) => {
        peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        peerConnection.createAnswer()
          .then((answer) => {
            return peerConnection.setLocalDescription(answer);
          })
          .then(() => {
            socket.emit('answer', peerConnection.localDescription);
          });
      });

      socket.on('answer', (answer) => {
        peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      });

      socket.on('iceCandidate', (candidate) => {
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      });

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('iceCandidate', event.candidate);
        }
      };

      peerConnection.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };
    }

    return () => {
      socket.disconnect();
    };

  }, []);


  return (
    <>
      {!hasJoinedRoom || isCallEnded  ? (
        <div className="entry-modal">
          <p>Create or Join Meeting</p>
          <input
            className="room-input"
            placeholder="Enter Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <div>
            <button onClick={() => createRoom(roomId)}>Create Room</button>
            <button onClick={() => joinRoom(roomId)}>Join Room</button>
          </div>
        </div>
      ) : (
        <div className="meet-area">
        <div className="video-area">
          <video id="remote-video" autoPlay playsInline></video>
          <video id="local-video" autoPlay muted playsInline></video>
        </div>
        <div className={`chat-area ${isChatOpen ? 'open' : 'closed'}`}>
            <div className="chat-messages">
              {chatMessages.map((message, index) => (
                <div key={index} className="chat-message">
                  {/* <strong>{message.sender}:</strong>  */}
                  {message.text} 
                  {/* ({message.timestamp}) */}
                </div>
              ))}
            </div>
            <div className="chat-input">
              <input
                type="text"
                placeholder="Type your message..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
              />
              <button onClick={() => sendChatMessage(messageInput)}>Send</button>
            </div>
          </div>
          <div className="end-call-button">
          {isCallOngoing ? (
            <>
              <button onClick={endCall} className='button1'><i class="fa-solid fa-phone" title='Leave call'></i></button>
              <button onClick={toggleLocalVideo} className='button1'>
                {isLocalVideoPaused ? <i class="fa-solid fa-video" title='Turn off camera'></i> : <i class="fa-solid fa-video-slash" title='Turn on camera'></i> }
              </button>
              <button onClick={toggleMicrophone} className='button1'>
              {isMicrophonePaused ? <i class="fa-solid fa-microphone" title='Turn off microphone'></i> : <i class="fa-solid fa-microphone-slash" title='Turn on microphone'></i>  }
            </button>
            <button onClick={startScreenSharing}>
              {isScreenSharing ? "Screen Share" : "Screen Share"}
            </button>
            <button onClick={() => setIsChatOpen(!isChatOpen)} className='button1' title='Chat'>
              {isChatOpen ? <i class="fa-solid fa-message"></i> : <i class="fa-solid fa-message"></i>}
            </button>
            </>
          ) : (
            <span>Call ended</span>
          )}
        </div>
      </div>
    )}
    {isCallEnded && (
      <div className="call-ended-popup">
        <p>Call Ended</p>
        <button onClick={() => setIsCallEnded(false)}>Close</button>
      </div>
    )}
  </>
);
}

export default App;