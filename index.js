const commandLineArgs = require('command-line-args');
const KeenTracking = require('keen-tracking');
const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline')
const { coefsCpmByMicroSvPerHour } = require('./configGmTubes');

const GMTubeType = 'LND-712';
let intervalChecker = undefined;

const options = commandLineArgs([
	{ name: 'project-id', alias: 'i', type: String },
	{ name: 'key',        alias: 'k', type: String },
	{ name: 'port',       alias: 'p', type: String, defaultValue: '/dev/ttyUSB0' },
	{ name: 'longitude',  alias: 'o', type: Number },
	{ name: 'latitude',   alias: 'a', type: Number },
	{ name: 'checker',    alias: 'c', type: Number, defaultValue: 10 },
	{ name: 'verbose',    alias: 'v', type: Boolean, defaultValue: false },
]);

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

const setIntervalChecker = (interval) => {
	return setTimeout(() => {
		console.log(`Exit according to no response from geiger counter in ${interval} minutes`);
		port.close();
		process.exit(1);
	}, interval * 60 * 1000);
}

port.pipe(new Readline());

port.on('open', () => {
	console.log('port opened!');
});

port.on('error', (err) => {
	console.log(JSON.stringify(err));
});

port.on('close', () => {
	console.log('port closed!');
});

port.on('data', (record) => {
	const now = new Date().toISOString();

	try {
		if (intervalChecker) {
			clearTimeout(intervalChecker);
			intervalChecker = undefined;
		}
		intervalChecker = setIntervalChecker(options.checker);

		const { cpm, sec } = JSON.parse(record.toString());
		const coef = coefsCpmByMicroSvPerHour[GMTubeType];
		const usv = (cpm / coef).toFixed(3);

		const radiationEvent = {
			type: GMTubeType,
			cpm: cpm,
			usv: usv,
			longitude: options.longitude,
			latitude: options.latitude,
			keen: {
				timestamp: now
			}
		};

		client.recordEvent('radiations', radiationEvent, (err, res) => {
			if (err) {
				console.log(`failed with ${err.message}`);
			} else {
				console.log(`${now}: ${GMTubeType}, ${cpm} CPM, ${usv} uSv/h, ${sec} seconds`);
			}
		});
	} catch (err) {
		console.log(`failed with ${err.message} on data '${record.toString()}'`);
	}
});

// Start interval checker
intervalChecker = setIntervalChecker(options.checker);

// Start logger process
port.open();
