const cluster = require('cluster');
const os = require('os');

if (cluster.isMaster) {
  // Fork workers based on the number of CPU cores
  const numCPUs = os.cpus().length;
  console.log(`Master cluster setting up ${numCPUs} workers...`);

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
} else {
  // Worker process code
  const axios = require('axios');
  const fs = require('fs');

  const proxyUrls = [
    'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
    'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks4.txt',
    'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt',
  ];

  async function scrapeProxies() {
    try {
      const proxies = [];

      // Fetch proxies from each URL
      for (const url of proxyUrls) {
        const response = await axios.get(url);
        const proxyList = response.data.split('\n');
        proxies.push(...proxyList);
      }

      // Remove empty lines
      const filteredProxies = proxies.filter((proxy) => proxy.trim() !== '');

      // Test and filter working proxies
      const workingProxies = await testProxies(filteredProxies);

      // Save working proxies to a file
      saveProxiesToFile(workingProxies);

      console.log(`Worker ${process.pid} completed proxy scraping and testing.`);
      process.exit(0);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  }

  async function testProxies(proxies) {
    const workingProxies = [];

    for (const proxy of proxies) {
      const isWorking = await testProxyConnection(proxy);

      if (isWorking) {
        console.log(`Working proxy found: ${proxy}`);
        workingProxies.push(proxy);
      } else {
        console.log(`Non-working proxy: ${proxy}`);
      }
    }

    return workingProxies;
  }

  async function testProxyConnection(proxy) {
    try {
      const response = await axios.get('https://www.example.com/', {
        proxy: {
          host: proxy.split(':')[0],
          port: proxy.split(':')[1],
          // Add other proxy options if necessary
        },
        timeout: 5000, // Set a timeout for the request
      });

      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  function saveProxiesToFile(proxies) {
    const fileName = 'working_proxies.txt';

    fs.writeFile(fileName, proxies.join('\n'), (err) => {
      if (err) {
        console.error('Error saving proxies to file:', err.message);
      } else {
        console.log(`Working proxies saved to ${fileName}`);
      }
    });
  }

  // Start the scraping process for each worker
  scrapeProxies();
}
