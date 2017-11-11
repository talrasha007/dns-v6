const dgram = require('dgram');
const Packet = require('native-dns-packet');

const server = dgram.createSocket('udp4');

const upstream = '8.8.8.8';

function dnsQuery(q) {
  return new Promise((resolve, reject) => {
    const sock = dgram.createSocket('udp4');

    if (Buffer.isBuffer(q)) {
      sock.send(q, 0, q.length, 53, upstream);
    } else {
      const buf = Buffer.alloc(4096);
      const bufLen = Packet.write(buf, q);
      sock.send(buf, 0, bufLen, 53, upstream);
    }

    sock.on('message', response => resolve({ response, packet: Packet.parse(response) }));
    sock.on('error', err => reject(err));
  });
}

function sendResponse(res, rinfo) {
  if (Buffer.isBuffer(res)) {
    server.send(res, 0, res.length, rinfo.port, rinfo.address);
  } else {
    const buf = Buffer.alloc(4096);
    const bufLen = Packet.write(buf, res);
    server.send(buf, 0, bufLen, rinfo.port, rinfo.address);
  }
}

server.on('message', async (msg, rinfo) => {
  const query = Packet.parse(msg);
  let isV4 = false, hasV6 = false;

  query.question.forEach(q => {
    console.log(q.type, q.name);
    if (q.type === Packet.consts.NAME_TO_QTYPE.A) {
      isV4 = true;
      q.type = Packet.consts.NAME_TO_QTYPE.AAAA;
    }
  });

  if (isV4) {
    const { packet } = await dnsQuery(query);
    hasV6 = !!packet.answer.find(a => a.type === Packet.consts.NAME_TO_QTYPE.AAAA);
  }

  const { packet, response } = await dnsQuery(msg);
  if (!isV4 || !hasV6) {
    sendResponse(response, rinfo);
  } else {
    // packet.answer = packet.answer.filter(a => a.type !== Packet.consts.NAME_TO_QTYPE.A);
    packet.answer = [];
    console.log(packet.answer);
    sendResponse(packet, rinfo);
  }
});

server.on('listening', () => {
  const address = server.address();
  console.log(`server listening ${address.address}:${address.port}`);
});

server.bind(1153);