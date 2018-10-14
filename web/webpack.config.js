const path = require('path');

module.exports = {
	entry: './src/geiger-chart.js',
	output: {
		filename: 'geiger-chart.js',
		path: path.resolve(__dirname, 'dist'),
	},
};
