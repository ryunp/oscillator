window.onload = init;

/*
 * Global vars
 */

var running = 0,
	audioCtx,
	gainNodeMaster,
	gainNodeUser,
	gainParams = {
		'gain': 0.2,
		'min': 0,
		'max': 1
	},
	oscNode,
	oscParams = {
		'type': 'sine',
		'freq': 3000,
		'detune': 0,
		'min': 20,
		'max': 18000
	},
	oscTypes = [
		'sine',
		'square',
		'sawtooth',
		'triangle'
	],
	analyser,
	canvas,
	hRaf,
	canvasCtx,
	bgHsl = [50,50,05],
	drawFnList = ['frequency', 'time'],
	drawFn = drawFnList[0];

/*
 * APIish functions
 */

function init() {
	// Create components
	audioCtx = new (window.AudioContext || window.webkitAudioContext)();
	analyser = audioCtx.createAnalyser();

	// Gain node
	gainNodeMaster = audioCtx.createGain();
	gainNodeMaster.gain.value = 0.7;

	// Analyser node
	canvas = document.getElementById("analyser_canvas");
	canvasCtx = canvas.getContext("2d");
	analyser.fftSize = 512;
	analyser.minDecibels = -90;
	analyser.maxDecibels = -10;
	analyser.smoothingTimeConstant = 0.85;	

	// Ooscillator node
	setOscType('sine');
	setOscFreq(2000);

	// UI
	initUI();
	updateBgColor();
}


function initUI() {
	
	// Add event handlers
	document.getElementById('freq_value').addEventListener('input', freqChanged);
	document.getElementById('freq_slider').addEventListener('input', freqChanged);
	document.getElementById('freq_slider').addEventListener('change', freqChanged);
	document.getElementById('type_dropdown').addEventListener('input', typeChanged);
	document.getElementById('display_dropdown').addEventListener('input', displayChanged);
	document.getElementById('start').addEventListener('click', startClicked);
	document.getElementById('stop').addEventListener('click', stopClicked);
	document.getElementById('gain_value').addEventListener('input', gainChanged);
	document.getElementById('gain_slider').addEventListener('input', gainChanged);
	document.getElementById('gain_slider').addEventListener('change', gainChanged);
	

	// Populate type dropdown
	var i, o, el;
	el = document.getElementById("type_dropdown");

	for (i = 0; i < oscTypes.length; i++) {
		o = document.createElement("option");
		t = document.createTextNode(oscTypes[i]);

		o.appendChild(t);
		el.appendChild(o);
	}

	// Populate display dropdown
	el = document.getElementById("display_dropdown");

	for (i = 0; i < drawFnList.length; i++) {
		o = document.createElement("option");
		t = document.createTextNode(drawFnList[i]);

		o.appendChild(t);
		el.appendChild(o);
	}
}

function start() {

	//	console.log("start");
	if (running)
		return;

	running = 1;
	
	// Setup gainNodeUser
	gainNodeUser = audioCtx.createGain();
	gainNodeUser.gain.value = gainParams.gain;

	// Setup Oscillator
	oscNode = audioCtx.createOscillator();
	oscNode.frequency.value = oscParams.freq;
	oscNode.type = oscParams.type;

	// Connect nodes
	oscNode.connect(gainNodeUser);
	gainNodeUser.connect(gainNodeMaster);
	gainNodeMaster.connect(analyser);
	gainNodeMaster.connect(audioCtx.destination);

	// Let 'er rip!
	oscNode.start();

	// Start visualizer
	visualize();
}


function stop() {

	//console.log("stop");
	if (!running)
		return;

	running = 0;

	oscNode.stop();

	if (hRaf) {
		window.cancelAnimationFrame(hRaf);
		hRaf = undefined;
	}

}


/*
 * Core functions
 */

function setOscType(type) {

	var idx = oscTypes.indexOf(type);

	if (idx >= 0) {
		oscParams.type = oscTypes[idx];
		
		if (oscNode)
			oscNode.type = type;
	} else
		console.log("setOscType: Type not one of: " + oscTypes.join(",") + "!");
}

function setDisplayType(fn) {

	var idx = drawFnList.indexOf(fn);

	if (idx >= 0) {

		drawFn = drawFnList[idx];
		console.log(drawFn);
		visualize();
	} else
		console.log("setDisplayType: Function not one of: " + drawFnList.join(",") + "!");
}

function setOscFreq(freq) {

	//console.log(freq);
	if (freq < oscParams.min && freq > oscParams.max) {

		console.log(arguments.callee.name + ": Frequency out of 20 - 18,000 range.");
		return 0;
	}

	oscParams.freq = freq; // value in hertz

	if (oscNode)
		oscNode.frequency.value = freq;

	// Update background color
	if (running) {

		bgHsl[0] = (freq - oscParams.min) / (oscParams.max - oscParams.min); // ratio
		bgHsl[0] = bgHsl[0] * 300; // expanded to required value range
		updateBgColor();
	}

	return 1;
}

function setGain(gain) {

	//console.log(gain);
	if (gain < gainParams.min && gain > gainParams.max) {

		console.log(arguments.callee.name + ": Gain out of 0 - 1 range.");
		return 0;
	}

	gainParams.gain = gain;

	if (gainNodeUser)
		gainNodeUser.gain.value = gain;

	// Update background color
	if (running) {

		bgHsl[2] = (gain - gainParams.min) / (gainParams.max - gainParams.min);
		bgHsl[2] = bgHsl[2] * 05 + 05;
		updateBgColor();
	}

	return 1
}


function visualize() {

	var width = canvas.width,
		height = canvas.height,
		x = 0,
		y = 0,
		sliceWidth;

	function init() {

		// Setup resolutions
		switch (drawFn) {
			case 'frequency':
				drawFn = draw_frequency;
				analyser.fftSize = 256;
				break;
			case 'time':
				drawFn = draw_time;
				analyser.fftSize = 1024;
				break;
		}
		
		bufferLength = analyser.frequencyBinCount;
		dataArray = new Uint8Array(bufferLength);

		canvasCtx.clearRect(0, 0, width, height);
	}

	function drawLoop() {

		drawFn();

		if (running)
			hRaf = requestAnimationFrame(drawLoop);
	}

	function draw_frequency() {

		analyser.getByteFrequencyData(dataArray);

		canvasCtx.fillStyle = '#FFFFFF';
		canvasCtx.fillRect(0, 0, width, height);

		var barWidth = (width / bufferLength),
			barHeight = 0,
			color;
		
		x = 0;

		for (var i = 0; i < bufferLength; i++) {

			barHeight = height * (dataArray[i] / 255);
			color = Math.round(barHeight / height * 300);

			canvasCtx.fillStyle = 'hsl(' + color + ', 50%, 50%)';
			canvasCtx.fillRect(x, height - barHeight, barWidth, barHeight);

			x += barWidth + 1;
			//console.log(i, x, barHeight, barWidth * i);
		}
	}

	function draw_time() {

		analyser.getByteTimeDomainData(dataArray);
	
		canvasCtx.fillStyle = '#FFFFFF';
		canvasCtx.fillRect(0, 0, width, height);

		canvasCtx.lineWidth = 2;
		canvasCtx.strokeStyle = '#006600';

		canvasCtx.beginPath();

		var v, sliceWidth = width / bufferLength;
		x = 0;

		console.log( dataArray );		
		for (var i = 0; i < bufferLength; i++) {

			v = dataArray[i] / 128;
			y = v * height / 2;

			if (i === 0)
				canvasCtx.moveTo(x, y);
			else
				canvasCtx.lineTo(x, y);

			x += sliceWidth;
		}


		canvasCtx.stroke();
	}

	init();
	drawLoop();
}

function updateBgColor() {
	
	var hsl = 'hsl(' + bgHsl[0] + ',' + bgHsl[1] + '%,' + bgHsl[2] + '%)';
	//console.log(bgHsl, hsl);
	document.body.style.backgroundColor = hsl;
}

/*
 * Event Handlers
 */

function startClicked(e) {

	start();
}


function stopClicked(e) {

	stop();
}


function typeChanged(e) {

	var val = e.target.value;
	
	// Update internal params
	//console.log(val);
	setOscType(val);
}

function displayChanged(e) {

	var val = e.target.value;
	
	// Update internal params
	//console.log(val);
	setDisplayType(val);
}


function freqChanged(e) {

	var val = e.target.value;

	// Update internal params
	if (!setOscFreq(val)) {
		val = (val > oscParams.max) ? oscParams.max : oscParams.min;
		setOscFreq(val);
	}

	// Update UI
	document.getElementById('freq_value').value = val;
	document.getElementById('freq_slider').value = val;
}


function gainChanged(e) {

	var val = e.target.value;

	// Update internal params
	if (!setGain(val)) {
		val = (val > gainParams.max) ? gainParams.max : gainParams.min;
		setGain(val);
	}
	
	// Update UI
	document.getElementById('gain_value').value = val;
	document.getElementById('gain_slider').value = val;
}
