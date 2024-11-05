const http = require('http');
const httpProxy = require('http-proxy');
const mongoose = require('mongoose');
const axios = require('axios');

mongoose.connect('mongodb://localhost:27017/loadBalancerDB')
.then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

const requestSchema = new mongoose.Schema({
  ip: String,
  location: {
    country: String,
    city: String,
    region: String,
    lat: Number,
    lon: Number
  },
  requestTime: { type: Date, default: Date.now }
});

const Request = mongoose.model('Request', requestSchema);

const servers = [
  { url: 'http://localhost:3001', alive: true },
  { url: 'http://localhost:3002', alive: true },
  { url: 'http://localhost:3003', alive: true }
];

const healthCheckInterval = 5000;

const proxy = httpProxy.createProxyServer({});

function healthCheck() {
  servers.forEach((server, index) => {
    http.get(server.url, (res) => {
      if (res.statusCode === 200) {
        servers[index].alive = true;
        console.log(`${server.url} is healthy`);
      } else {
        servers[index].alive = false;
        console.log(`${server.url} is unhealthy`);
      }
    }).on('error', () => {
      servers[index].alive = false;
      console.log(`${server.url} is down`);
    });
  });
}

setInterval(healthCheck, healthCheckInterval);

function getNextServer() {
  let deadServerCount = 0;
  const totalServers = servers.length;

  while (deadServerCount < totalServers) {
    const server = servers[0];  

    if (server.alive) {
      servers.push(servers.shift());  
      return server;
    } else {
      deadServerCount++;
      servers.push(servers.shift());  
    }
  }

  return null;
}

async function getLocationFromIP(ip) {
  try {
    const response = await axios.get(`http://ip-api.com/json/${ip}`);
    const data = response.data;
    return {
      country: data.country,
      city: data.city,
      region: data.regionName,
      lat: data.lat,
      lon: data.lon
    };
  } catch (error) {
    console.error('Error fetching location:', error);
    return null;
  }
}

function getClientIP(req) {
  console.log(req.headers['x-forwarded-for'] + "," + req.connection.remoteAddress);
  return req.headers['x-forwarded-for'] || req.connection.remoteAddress;
}

const loadBalancer = http.createServer(async (req, res) => {
  try {
    const targetServer = getNextServer();  // Get the next available server
    if (!targetServer) {
      // If no healthy servers are available, send a 503 response
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      res.end('Service Unavailable');
      return;
    }

    const clientIP = getClientIP(req);     // Extract client IP address

    const location = await getLocationFromIP(clientIP);


    const newRequest = new Request({
      ip: clientIP,
      location: location
    });
    await newRequest.save();

    console.log(`Forwarding request to: ${targetServer.url} from IP: ${clientIP}`);

    
    proxy.web(req, res, { target: targetServer.url }, (err) => {
      if (err) {
        console.error('Proxy error:', err);
        res.writeHead(502);
        res.end('Bad Gateway');
      }
    });
  } catch (error) {
    console.error(error.message);
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});


loadBalancer.listen(8000, () => {
  console.log('Load balancer running on port 8000');
});
