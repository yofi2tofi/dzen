const puppeteer = require('puppeteer');
const proxyChain = require('proxy-chain');
const chance = require('chance').Chance();

const devices = require('./devices');

const generateUUID = function() {
  return '1xxxxxxxxx.xxx.1xxxxxxxxxxxx.xxxxx'
    .replace(/[xy]/g, function(c) {
      var r = (Math.random() * 9) | 0;
      return r.toString();
    })
    .toLowerCase();
};

const medias = [
  'https://zen.yandex.ru/media/id/5d1dd138fd076900ae7cdf8d/mojno-li-nosit-noski-i-sandalii-5d1f243a73247700ac2d5969',
  'https://zen.yandex.ru/media/id/5d1dd138fd076900ae7cdf8d/top-mejdunarodnyh-modnyh-novostei-nedeli--230619-5d1e1ce2540eaf00ad1559d5'
];

const proxies = [
  '2f56DP:yRqrbrEtYQ@95.182.127.246:5500',
  '2f56DP:yRqrbrEtYQ@37.139.48.252:3232',
  '2f56DP:yRqrbrEtYQ@37.139.48.248:10374',
  '2f56DP:yRqrbrEtYQ@146.185.209.249:9834',
  '2f56DP:yRqrbrEtYQ@5.188.215.247:7948',
  '2f56DP:yRqrbrEtYQ@37.139.48.250:10150',
  '2f56DP:yRqrbrEtYQ@37.139.48.250:7010'
];

const integrations = ['opera_ntp', 'morda_zen_lib', 'desktop_browser_rezen'];

const server = new proxyChain.Server({
  port: 8000,
  prepareRequestFunction: object => {
    return {
      requestAuthentication: false,
      upstreamProxyUrl: `http://${
        proxies[Math.floor(Math.random() * proxies.length)]
      }`
    };
  }
});

server.listen(() => {
  console.log(`Proxy server is listening on port ${8000}`);
});

const rangeLimit = 1;
const rangePositiveLimit = 1;
const rangeNegativeLimit = rangeLimit - rangePositiveLimit;
let positiveRange = 0;
let negativeRange = 0;

const runJob = async () => {
  try {
    const deviceIndex = Math.floor(Math.random() * devices.length);
    const deviceName = devices[deviceIndex].name;
    const device = puppeteer.devices[deviceName];

    const linkIndex = Math.floor(Math.random() * medias.length);
    const link = medias[linkIndex];
    const feed = `?from=feed&utm_referrer=https://zen.yandex.com&rid=${generateUUID()}`;
    const closure = `&integration=${
      integrations[Math.floor(Math.random() * integrations.length)]
    }&place=export`;
    const url = link + feed + closure;

    const browser = await puppeteer.launch({
      devtools: true,
      executablePath:
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: false,
      args: [
        `--proxy-server=http://127.0.0.1:8000`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars'
      ],
      defaultViewport: device.viewport
    });
    const page = await browser.newPage();
    await page.emulate(device);

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false
      });
    });

    await page.evaluateOnNewDocument(() => {
      const originalQuery = window.navigator.permissions.query;
      return (window.navigator.permissions.query = parameters =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters));
    });

    await page.goto(url), { timeout: 0, waitUntil: 'networkidle2' };

    const isWillReadingPredicate = !!Math.round(Math.random());
    let isWillReading;
    if (isWillReadingPredicate && positiveRange < rangePositiveLimit) {
      positiveRange += 1;
      isWillReading = true;
    } else if (!isWillReadingPredicate && negativeRange < rangeNegativeLimit) {
      negativeRange += 1;
      isWillReading = false;
    } else {
      isWillReading = true;
    }
    console.log(isWillReading);

    let viewInto = { count: 0, availableScrollHeight: null };
    await new Promise((resolve, reject) => {
      let availableScrollHeight = null;
      const scroll = async () => {
        const scrollStep = chance.natural({ min: 2, max: 7 }); // medium 5
        const scrollDelay = chance.natural({ min: 13, max: 32 }); // medium 25
        const holdTime = chance.natural({ min: 772, max: 1211 }); // medium 800
        const scrollTime = chance.natural({ min: 267, max: 300 }); // medium 270

        viewInto = await scrollPageToBottom(
          page,
          scrollStep,
          scrollDelay,
          scrollTime,
          viewInto.count
        );

        if (!availableScrollHeight) {
          availableScrollHeight =
            viewInto.availableScrollHeight - device.viewport.height;
        }

        if (
          viewInto.count >=
            (availableScrollHeight / 100) *
              chance.natural({ min: 23, max: 36 }) &&
          !isWillReading
        ) {
          return resolve();
        }

        if (viewInto.count >= availableScrollHeight) {
          return resolve();
        }

        if (viewInto.count >= 0) {
          setTimeout(async () => await scroll(), holdTime);
        } else {
          resolve();
        }
      };
      scroll();
    });

    await page.tap('#content-ending .mittens__mitten_like');

    await new Promise(resolve => {
      setTimeout(() => {
        browser.close();
        resolve();
      }, 20600);
    });

    return { status: 'ok' };
  } catch (e) {
    console.log(e);
    browser.close();
    return { status: 'false' };
  }
};

/**
 * Scrolling page to bottom based on Body element
 * @param {Object} page Puppeteer page object
 * @param {Number} scrollStep Number of pixels to scroll on each step
 * @param {Number} scrollDelay A delay between each scroll step
 * @returns {Number} Last scroll position
 */
async function scrollPageToBottom(
  page,
  scrollStep,
  scrollDelay,
  scrollTime,
  startPosition
) {
  const lastPosition = await page.evaluate(
    async (step, delay, scroll, startPosition) => {
      const getScrollHeight = element => {
        const { scrollHeight, offsetHeight, clientHeight } = element;
        return Math.max(scrollHeight, offsetHeight, clientHeight);
      };

      const position = await new Promise(resolve => {
        let count = startPosition ? startPosition : 0;
        const intervalId = setInterval(() => {
          setTimeout(() => {
            clearInterval(intervalId);
            resolve({ count, availableScrollHeight });
          }, scroll);

          const body = document.body;
          const availableScrollHeight = getScrollHeight(body);

          window.scrollBy(0, step);
          count += step;
        }, delay);
      });

      return position;
    },
    scrollStep,
    scrollDelay,
    scrollTime,
    startPosition
  );
  return { ...lastPosition };
}

// runJob('http://myip.ru');
// runJob('https://amiunique.org/fp');
// runJob('https://detectmybrowser.com');

(async () => {
  const interval = async () => {
    const { status } = await runJob();

    // if (status === 'ok') {
    //   setTimeout(() => {
    //     if (positiveRange + negativeRange < rangeLimit) {
    //       interval();
    //     }
    //   }, chance.natural({ min: 1250, max: 3010 }));
    // }
  };

  await interval();
})();
