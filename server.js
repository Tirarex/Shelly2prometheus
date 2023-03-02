

const http = require('http');
const url = require('url');
const { Registry, Gauge } = require('prom-client');


const jsonLink = process.env.JSON_LINK || 'http://192.168.88.22/rpc/Shelly.GetStatus';
const apowerGaugeName = process.env.APOWER_GAUGE_NAME || 'shelly_apower';
const voltageGaugeName = process.env.VOLTAGE_GAUGE_NAME || 'shelly_voltage';
const UpdateRateMS = process.env.UPDATE_RATEMS || 5000;

const registry = new Registry();
const apowerGauge = new Gauge({
    name: apowerGaugeName,
    help: apowerGaugeName + ' power usage in watts',
    registers: [registry]
});
const voltageGauge = new Gauge({
    name: voltageGaugeName,
    help: voltageGaugeName + ' voltage in volts',
    registers: [registry]
});

apowerGauge.set(0);
voltageGauge.set(0);

const updateMetrics = async () => {
    try {
        const parsedUrl = url.parse(jsonLink);
        const options = {
            host: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: parsedUrl.pathname + (parsedUrl.search || ''),
            headers: { 'User-Agent': 'nodejs' },
        };
        const request = http.get(options, (response) => {
            let data = Buffer.from('');
            response.on('data', (chunk) => {
                data = Buffer.concat([data, chunk]);
            });
            response.on('end', () => {
                const { apower, voltage } = JSON.parse(data.toString())['switch:0'];
                apowerGauge.set(apower);
                voltageGauge.set(voltage);
            });
        });
        request.on('error', (err) => {
            console.error(`Error while fetching data: ${err}`);
        });
    } catch (err) {
        console.error(`Error while parsing JSON link: ${err}`);
    }
};

setInterval(updateMetrics, UpdateRateMS);


const server = http.createServer(async (req, res) => {
    if (req.url === '/metrics') {
        const metrics = await registry.metrics();
        res.setHeader('Content-Type', registry.contentType);
        res.end(metrics);
    } else {
        res.statusCode = 404;
        res.end();
    }
});

server.listen(3333, () => {
    console.log('Server listening on port 3333');
});
