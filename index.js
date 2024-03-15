javascript
const cluster = require('cluster');
const os = require('os');
const axios = require('axios');
const fs = require('fs');

const MAX_CONCURRENT_TESTS = 25;

if (cluster.isMaster) {
  const numCPUs = os.cpus().length;
  let totalProxiesScanned = 0;

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('online', (worker) => {
    console.log(`Worker ${worker.process.pid} is online`);
  });

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died with code ${code} and signal ${signal}`);
    console.log('Starting a new worker');
    cluster.fork();
  });

  cluster.on('message', (worker, message) => {
    if (message.type === 'progress') {
      totalProxiesScanned += message.proxiesScanned;
      console.log(`Worker ${worker.process.pid}: ${message.message} (Total proxies scanned: ${totalProxiesScanned})`);
    } else {
      console.log(`Unknown message type received from worker ${worker.process.pid}:`, message);
    }
  });
} else {
  scrapeProxies();
}

async function scrapeProxies() {
  const proxyUrls = [
    'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
    'https://raw.githubusercontent.com/prxchk/proxy-list/main/http.txt',
    'https://raw.githubusercontent.com/Zaeem20/FREE_PROXIES_LIST/master/http.txt',
    'https://raw.githubusercontent.com/vakhov/fresh-proxy-list/master/http.txt'
  ];

  try {
    const allProxies = [];
    for (const url of proxyUrls) {
      const response = await axios.get(url);
      const proxyList = response.data.split('\n');
      const filteredProxies = proxyList.filter((proxy) => proxy.trim() !== '');
      allProxies.push(...filteredProxies);
    }

    const shuffledProxies = shuffleArray(allProxies);

    for (let i = 0; i < shuffledProxies.length; i += MAX_CONCURRENT_TESTS) {
      const proxyBatch = shuffledProxies.slice(i, i + MAX_CONCURRENT_TESTS);
      const results = await Promise.all(proxyBatch.map(testAndSaveProxy));
      process.send({ type: 'progress', proxiesScanned: proxyBatch.length, message: `Proxy batch scanned` });
    }

    console.log(`Proxy scraping and testing completed in worker ${process.pid}`);
    process.exit(0);
  } catch (error) {
    console.error(`Error in worker ${process.pid}:`, error.message);
    process.exit(1);
  }
}

function shuffleArray(array) {
  const shuffled = array.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const uniqueProxies = new Set();

async function testAndSaveProxy(proxy) {
  try {
    const isWorking = await testProxyConnection(proxy);

    if (isWorking) {
      if (!uniqueProxies.has(proxy)) {
        uniqueProxies.add(proxy);
        saveProxyToFile(proxy);
        return { proxy, message: `Working proxy saved in worker ${process.pid}: ${proxy}` };
      } else {
        return { proxy, message: `Duplicate proxy skipped in worker ${process.pid}: ${proxy}` };
      }
    } else {
      return { proxy, message: `Non-working proxy in worker ${process.pid}: ${proxy}` };
    }
  } catch (error) {
    return { proxy, message: `Error testing proxy in worker ${process.pid}: ${proxy} - ${error.message}` };
  }
}

async function testProxyConnection(proxy) {
  const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));

  try {
    const response = await Promise.race([
      axios.get('https://www.example.com/', {
        proxy: {
          host: proxy.split(':')[0],
          port: proxy.split(':')[1],
        },
      }),
      timeoutPromise,
    ]);

    return response.status === 200;
  } catch (error) {
    return false;
  }
}

function saveProxyToFile(proxy) {
  const fileName = 'working_proxies.txt';

  fs.appendFile(fileName, proxy + '\n', (err) => {
    if (err) {
      console.error(`Error saving proxy to file in worker ${process.pid}: ${proxy}`);
    }
  });
}
