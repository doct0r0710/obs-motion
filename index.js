const OBSWebSocket = require('obs-websocket-js').default;
const cv = require('@techstark/opencv-js');
const Jimp = require('jimp');

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Settings over here
const wsAddress = '127.0.0.1:4455'; // OBS Websocket address
const wsPassword = '123456'; // OBS Websocket password
const obsSource = 'CameraPic'; // OBS Source name
const obsImageWidth = 192; // Checked image resolution width (keep this around 1/10 of the source resolution)
const obsImageHeight = 108; // Checked image resolution width (keep this around 1/10 of the source resolution)
const saveAfter = 120; // Seconds after replay buffer is saved. Reccommended: OBS Replay Buffer length + 5s.
const motionLimit = 20; // How big of a change is needed to trigger motion detection. Higher is less sensitive
const imageInterval = .5; // How often to check for differences in the source image
const avgSize = 10; // Averaging depth

const debug = true; // Displays standard deviance, current deviance and difference in console if set to true.
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

let avgArr = [];
let motionDetected = false;
let prevImg;

const obs = new OBSWebSocket();

async function connect() {
    try {
        const {
            obsWebSocketVersion,
            negotiatedRpcVersion
        } = await obs.connect('ws://' + wsAddress, wsPassword, {
            rpcVersion: 1
        });
        console.log(`Connected to server ${obsWebSocketVersion} (using RPC ${negotiatedRpcVersion})`);
        setInterval(() => {
            if (!motionDetected) {
                loadImg().then((img) => {
                    const diff = processImg(img);
                    if (diff !== undefined) {
                        avgArr.unshift(diff);
                        if (avgArr.length == avgSize) {
                            avgArr.pop();
                            const dev = stdev(avgArr);
                            const current = Math.pow(diff - mean(avgArr), 2);
                            const currentDev = Math.abs(current - dev);
                            if (debug) {
                                console.log(dev, current, currentDev);
                            }
                            if (currentDev > motionLimit) {
                                console.log("Motion detected. Saving replay in " + saveAfter + " seconds. (Mag: " + currentDev + ")");
                                motionDetected = true;
                                setTimeout(async () => {
                                    await obs.call('SaveReplayBuffer', {});
                                    motionDetected = false;
                                    avgArr = [];
                                }, saveAfter * 1000);
                            }
                        } else {
                            console.log("Accumulating averages");
                        }
                    }
                }, (err) => {
                    console.log(err);
                });
            }
        }, imageInterval * 1000);
    } catch (error) {
        console.error('Failed to connect', error.code, error.message);
    }
}

async function loadImg() {
    return new Promise(async (resolve, reject) => {
        const img = await obs.call('GetSourceScreenshot', {
            sourceName: obsSource,
            imageFormat: "jpeg",
            imageWidth: obsImageWidth,
            imageHeight: obsImageHeight
        });
        let url = img.imageData.split(',')[1];
        let buffer = Buffer.from(url, 'base64');
        Jimp.read(buffer).then(img => {
            resolve(cv.matFromImageData(img.bitmap));
        }).catch(function (err) {
            reject(err);
        });
    });
}

function processImg(img) {
    if (!prevImg) {
        prevImg = img;
        return;
    }

    let diff = new cv.Mat();
    cv.absdiff(prevImg, img, diff);

    let sum = 0
    for (row = 0; row < diff.rows; row++) {
        for (col = 0; col < diff.cols; col++) {
            sum += diff.ucharPtr(row, col)[0] + diff.ucharPtr(row, col)[1] + diff.ucharPtr(row, col)[2];
        }
    }

    prevImg = img;
    return sum / (diff.rows * diff.cols);
}

function stdev(array) {
    const avg = mean(array);
    return Math.sqrt(array.map(x => Math.pow(x - avg, 2)).reduce((a, b) => a + b) / array.length);
}

function mean(array) {
    return array.reduce((a, b) => a + b) / array.length;
}

connect();