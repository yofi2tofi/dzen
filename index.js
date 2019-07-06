const puppeteer = require('puppeteer');
const proxyChain = require('proxy-chain');
const chance = require('chance').Chance();

const devices = require('./devices');
const proxies = require('./proxies');

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
  'https://zen.yandex.ru/media/id/5d1dd138fd076900ae7cdf8d/top-mejdunarodnyh-modnyh-novostei-nedeli--230619-5d1e1ce2540eaf00ad1559d5',
  'https://zen.yandex.ru/media/id/5d1dd138fd076900ae7cdf8d/5-luchshih-sovetov-po-stiliu-5d207e63c91a9a00adf1b2ff'
];

const integrations = [
  'opera_ntp',
  'morda_zen_lib',
  'desktop_browser_rezen'
  // 'trendymenru_widget' у них только place=teaser
];

const instance = port => {
  const rangeLimit = 10;
  const rangePositiveLimit = 7;
  const rangeNegativeLimit = rangeLimit - rangePositiveLimit;
  let positiveRange = 0;
  let negativeRange = 0;

  const likeRangeLimit = rangePositiveLimit;
  const rangePositiveLikeLimit = Math.round((rangePositiveLimit / 100) * 15);
  const rangeNegativeLikeLimit = likeRangeLimit - rangePositiveLikeLimit;
  let positiveLikeRange = 0;
  let negativeLikeRange = 0;

  const runJob = async () => {
    let browser;
    let server;
    const proxy = proxies[Math.floor(Math.random() * proxies.length)];
    try {
      server = new proxyChain.Server({
        port,
        prepareRequestFunction: object => {
          return {
            requestAuthentication: false,
            upstreamProxyUrl: `http://${proxy}`
          };
        }
      });

      await new Promise(resolve => {
        server.listen(() => {
          console.log(`Proxy server is listening on port ${port}`);
          resolve();
        });
      });

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

      browser = await puppeteer.launch({
        devtools: false,
        executablePath:
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: false,
        args: [
          `--proxy-server=http://127.0.0.1:${port}`,
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-infobars',
          `--window-size=${device.viewport.width},${device.viewport.height}`
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
      } else if (
        !isWillReadingPredicate &&
        negativeRange < rangeNegativeLimit
      ) {
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
          const holdTime = chance.natural({ min: 772, max: 1511 }); // medium 1200
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

      const isWillLikePredicate = !!Math.round(Math.random());
      let isWillLike;
      if (isWillLikePredicate && positiveLikeRange < rangePositiveLikeLimit) {
        positiveLikeRange += 1;
        isWillLike = true;
      } else if (
        !isWillLikePredicate &&
        negativeLikeRange < rangeNegativeLikeLimit
      ) {
        negativeLikeRange += 1;
        isWillLike = false;
      } else {
        isWillLike = true;
      }

      console.log(isWillLike);

      if (isWillLike) {
        await page.tap('#content-ending .mittens__mitten_like');
      }

      await new Promise(resolve => {
        setTimeout(() => {
          browser.close();
          resolve();
        }, 4600);
      });

      server.close(() => {
        console.log('Server closed!');
      });

      return { status: 'ok' };
    } catch (e) {
      console.log('error', e);
      console.log(proxy);
      browser.close();

      server.close(() => {
        console.log('Server closed!');
      });
      return { status: 'ok' };
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

      if (status === 'ok') {
        setTimeout(() => {
          if (positiveRange + negativeRange < rangeLimit) {
            interval();
          }
        }, chance.natural({ min: 1000 * 60 * 2, max: 1000 * 60 * 5 }));
      }
    };

    setTimeout(
      async () => await interval(),
      chance.natural({ min: 1000 * 60 * 2, max: 1000 * 60 * 5 })
    );
  })();
};

let port = 8000;
for (let i = 0; i < 15; i++) {
  instance(port);
  port++;
}
