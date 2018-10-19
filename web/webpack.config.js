const path = require('path');

module.exports = {
	mode: 'development',
	entry: ['@babel/polyfill', './src/geiger-chart.js'],
	output: {
		filename: 'geiger-chart.js',
		path: path.resolve(__dirname, 'dist'),
	},
	module: {
		rules: [
			{
				test: /\.js$/,
				use: {
					loader: 'babel-loader',
					options: {
						presets: [
							'@babel/preset-env',
						]
					}
				}
			},
		]
	},
};
