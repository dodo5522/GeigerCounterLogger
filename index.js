const commandLineArgs = require('command-line-args');
const KeenTracking = require('keen-tracking');
const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline')
const { coefsCpmByMicroSvPerHour } = require('./configGmTubes');

const GMTubeType = 'LND-712';
let watchDogTimer = undefined;

const options = commandLineArgs([
	{ name: 'project-id', alias: 'i', type: String },
	{ name: 'key',        alias: 'k', type: String },
	{ name: 'port',       alias: 'p', type: String, defaultValue: '/dev/ttyUSB0' },
	{ name: 'longitude',  alias: 'o', type: Number },
	{ name: 'latitude',   alias: 'a', type: Number },
	{ name: 'timeout',    alias: 't', type: Number, defaultValue: 10 },
	{ name: 'log',        type: String },
	{ name: 'log-level',  type: String, defaultValue: 'error' },
]);

const logger = require('simple-node-logger')
	.createSimpleLogger((options['log']) ? options.log : undefined);
logger.setLevel(options['log-level']);

const client = new KeenTracking({
	projectId: options['project-id'],
	writeKey: options['key']
});

const port = new SerialPort(
	options.port,
	{
		autoOpen: false,
		baudRate: 19200,
	}
);

const startWatchDogTimer = (timeout) => {
	clearTimeout(watchDogTimer);

	return watchDogTimer = setTimeout(() => {
		port.close();
		process.exit(1);
	}, timeout * 60 * 1000);
}

port.pipe(new Readline({ delimiter: '\r' }));

port.on('open', () => {
	logger.info('port opened!');

	// Start interval checker
	startWatchDogTimer(options.timeout);
});

port.on('error', (err) => {
	logger.info(JSON.stringify(err));
});

port.on('close', () => {
	logger.info('port closed!');
});

let storedRecord = undefined;

port.on('data', (record) => {
	const now = Date.now();

	try {
		const r = record.toString();
		if (r.indexOf('{') >= 0) {
			storedRecord = r;
			return;
		} else if (storedRecord && r.indexOf('}') < 0) {
			storedRecord += r;
			return;
		}

		const { cpm, sec } = JSON.parse(storedRecord + r);
		storedRecord = undefined;

		startWatchDogTimer(options.timeout);

		const coef = coefsCpmByMicroSvPerHour[GMTubeType];
		const usv = Number((cpm / coef).toFixed(3));

		const radiationEvent = {
			type: GMTubeType,
			cpm: cpm,
			usv: usv,
			longitude: options.longitude,
			latitude: options.latitude,
			timestamp: now,
			keen: {
				timestamp: new Date(now).toISOString,
      }
		};

		client.recordEvent('radiations', radiationEvent, (err, res) => {
			if (err) {
				logger.warn(`failed with ${err.message}`);
			} else {
				logger.debug(`${now}: ${GMTubeType}, ${cpm} CPM, ${usv} uSv/h, ${sec} seconds`);
			}
		});
	} catch (err) {
		logger.warn(`failed with ${err.message} on data '${record.toString()}'`);
	}
});

// Start logger process
port.open();
