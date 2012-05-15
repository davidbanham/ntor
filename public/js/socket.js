var socket = io.connect();
socket.on('torrentChange', function(data) {
  console.log(data);
});
