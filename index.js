const commandLineArgs = require('command-line-args');
const KeenTracking = require('keen-tracking');
const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline')
const { coefsCpmByMicroSvPerHour } = require('./configGmTubes');

const GMTubeType = 'LND-712';

const options = commandLineArgs([
	{ name: 'project-id', alias: 'i', type: String },
	{ name: 'key',        alias: 'k', type: String },
	{ name: 'port',       alias: 'p', type: String, defaultOption: '/dev/ttyUSB0' },
	{ name: 'longitude',  alias: 'o', type: Number },
	{ name: 'latitude',   alias: 'a', type: Number },
	{ name: 'verbose',    alias: 'v', type: Boolean, defaultOption: false },
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

port.on('data', (data) => {
	try {
		const now = new Date().toISOString();
		const cpm = Number(/(\d+)/.exec(data.toString())[0]);
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
				console.log(`${now}: ${GMTubeType}, ${cpm} CPM, ${usv} uSv/h`);
			}
		});
	} catch (err) {
		console.log(`failed with ${err.message}`);
	}
});

port.open();
