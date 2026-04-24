const fs = require('fs');
const https = require('https');

const API_KEY = 'AIzaSyAEfP-ID2Na7g1haCRMhs9lDAmk2haHaGo';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL = 'veo-3.1-generate-preview';

async function fetchJson(url, options) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(JSON.parse(data));
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // handle redirect
                downloadFile(response.headers.location, dest).then(resolve).catch(reject);
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

async function generateVideo() {
    const prompt = "Cinematic, tracking shot of a luxurious black Mercedes S-Class driving smoothly through the glowing streets of London at twilight. The car looks pristine and high-end, reflecting city lights. The vibe is premium, reliable, and corporate-clean. Shot in 4k with realistic lighting and reflections.";
    
    console.log(`Starting generation with prompt: "${prompt}"`);
    
    const requestBody = JSON.stringify({
        instances: [{
            prompt: prompt
        }],
        parameters: {
            aspectRatio: "16:9",
            resolution: "1080p"
        }
    });

    try {
        const startResponse = await fetchJson(`${BASE_URL}/models/${MODEL}:predictLongRunning?key=${API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: requestBody
        });

        const operationName = startResponse.name;
        console.log(`Operation started: ${operationName}`);

        while (true) {
            console.log('Checking status...');
            const statusResponse = await fetchJson(`${BASE_URL}/${operationName}?key=${API_KEY}`, {
                method: 'GET'
            });

            if (statusResponse.done) {
                if (statusResponse.error) {
                    console.error("Generation failed:", statusResponse.error);
                    return;
                }
                const videoUri = statusResponse.response.generateVideoResponse.generatedSamples[0].video.uri;
                console.log(`Video ready! Downloading from ${videoUri}...`);
                
                await downloadFile(`${videoUri}&key=${API_KEY}`, 'airport_transfer_hero.mp4');
                console.log('Video downloaded successfully as airport_transfer_hero.mp4');
                break;
            }

            // Wait 10 seconds before polling again
            await new Promise(r => setTimeout(r, 10000));
        }
    } catch (err) {
        console.error("Error:", err);
    }
}

generateVideo();
