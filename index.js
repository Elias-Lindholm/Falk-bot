(async () => {
  const axios = require('axios');
  const fs = require('fs');

  const proxyUrls = [
    'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
    'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks4.txt',
    'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt',
  ];

  async function scrapeProxies() {
    try {
      // Fetch proxies from each URL
      for (const url of proxyUrls) {
        const response = await axios.get(url);
        const proxyList = response.data.split('\n');
        const filteredProxies = proxyList.filter((proxy) => proxy.trim() !== '');

        // Test and save working proxies immediately
        for (const proxy of filteredProxies) {
          const isWorking = await testProxyConnection(proxy);

          if (isWorking) {
            saveProxyToFile(proxy);
          }
        }

        console.log(`Scanning for proxies completed from: ${url}`);
      }

      console.log('Proxy scraping and testing completed.');
    } catch (error) {
      console.error('Error:', error.message);
    }
  }

  async function testProxyConnection(proxy) {
    try {
      const response = await axios.get('https://www.example.com/', {
        proxy: {
          host: proxy.split(':')[0],
          port: proxy.split(':')[1],
        },
        timeout: 5000,
      });

      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  function saveProxyToFile(proxy) {
    const fileName = 'working_proxies.txt';

    fs.appendFile(fileName, proxy + '\n', (err) => {
      if (err) {
        console.error(`Error saving proxy to file: ${proxy}`);
      } else {
        console.log(`Working proxy saved: ${proxy}`);
      }
    });
  }

  // Start the continuous scraping process
  setInterval(scrapeProxies, 60 * 1000); // Scrape proxies every 60 seconds
})();
