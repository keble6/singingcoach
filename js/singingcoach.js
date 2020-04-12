/* My code is based on: cwilso/Pitchdetect

The MIT License (MIT)

Copyright (c) 2014 Chris Wilson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
/* added to check if gUM (getUserMedia) is supported by browser*/
/*if (navigator.mediaDevices) {
			console.log('getUserMedia supported.');
} else {
			console.log('getUserMedia not supported on your browser!');
}*/

/* TO DOs */
/* A drawChart timer - so that we only draw the chart at a fixed rate */
/* A GUI to choose:
  Vocal range - 2 octaves?
  Accompaniment - scale/single note/sequence and note length and bpm
  */

// draw the chart every 100ms


//parameters for the chart table
var chart_table_length=64;
var chartReady = true;
var timeAndNote = [[performance.now(),60],[performance.now()+1,61]]; //initial chart table - we will fill it from upDate function

// load the chart's Google code and then call drawChart function
google.charts.load('current', {'packages':['corechart']});
google.charts.setOnLoadCallback(drawChart);

// now run
window.AudioContext = window.AudioContext || window.webkitAudioContext;

var isSquelched=true; //true when audio intput is too low. It is set/reset by updatePitch, depending on ac from autoCorrelate()
var audioContext = null;
// new flags for each type of input
var isVoice = false;
var isScale = false;
var isOsc = false;

var sourceNode = null;
var oscillator = null;
var analyser = null;
var theBuffer = null;
var DEBUGCANVAS = null;
var mediaStreamSource = null;

// new 11/4/20
setTimeout(ifPlayingDrawChart, 100);
function ifPlayingDrawChart() {
  console.log('timeout function');
  if(isVoice || isScale){ //voice or scale are running
    console.log('timeout function and playing');
    drawChart();
  }
}
/************************************************ */
/* functions for voice input */
function error() {
    const errorMessage = 'navigator.MediaDevices.getUserMedia error: ' + error.message + ' ' + error.name;
  console.log(errorMessage);
}
/************************************************ */

const constraints = window.constraints = {
  audio: true,
  video: false
};
/************************************************ */
function getAudio() {
 //navigator.mediaDevices.getUserMedia(constraints).then(gotStream).catch(error);
 //REPLACED ABOVE LINE WITH FOLLOWING FROM https://github.com/webrtc/samples/tree/gh-pages/src/content/getusermedia/audio/js
  navigator.mediaDevices.getUserMedia(constraints).then(gotStream).catch(error);
}
/************************************************ */

function gotStream(stream) {
  //console.log('in gotStream');
  const audioTracks = stream.getAudioTracks();
  console.log('Got stream with constraints:', constraints);
  console.log('Using audio device: ' + audioTracks[0].label);
  stream.oninactive = function() {
    console.log('Stream ended');
  };
  window.stream = stream; // make variable available to browser console
  //audio.srcObject = stream;
  // Create an AudioNode from the stream.
    mediaStreamSource = audioContext.createMediaStreamSource(stream);
    // Connect it to the destination.
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    mediaStreamSource.connect( analyser );
    updatePitch();
}

/********************* Scale functions *********************/
function playNote(startTime, duration, pitch) { //new oscillator created for every note (allows an effective restart)
  const oscillator = audioContext.createOscillator();
  
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  oscillator.connect(analyser);
  analyser.connect(audioContext.destination);
  oscillator.frequency.value = pitch;
  oscillator.type = 'sine';
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

/*************** notes ************/
const notes = {
    C0: 16.351, Db0: 17.324, D0: 18.354, Eb0: 19.445, E0: 20.601, F0: 21.827, Gb0: 23.124, G0: 24.499, Ab0: 25.956, A0: 27.5, Bb0: 29.135, B0: 30.868,
    C1: 32.703, Db1: 34.648, D1: 36.708, Eb1: 38.891, E1: 41.203, F1: 43.654, Gb1: 46.249, G1: 48.999, Ab1: 51.913, A1: 55, Bb1: 58.27, B1: 61.735,
    C2: 65.406, Db2: 69.296, D2: 73.416, Eb2: 77.782, E2: 82.407, F2: 87.307, Gb2: 92.499, G2: 97.999, Ab2: 103.826, A2: 110, Bb2: 116.541, B2: 123.471,
    C3: 130.813, Db3: 138.591, D3: 146.832, Eb3: 155.563, E3: 164.814, F3: 174.614, Gb3: 184.997, G3: 195.998, Ab3: 207.652, A3: 220, Bb3: 233.082, B3: 246.942,
    C4: 261.626, Db4: 277.183, D4: 293.665, Eb4: 311.127, E4: 329.628, F4: 349.228, Gb4: 369.994, G4: 391.995, Ab4: 415.305, A4: 440, Bb4: 466.164, B4: 493.883,
    C5: 523.251, Db5: 554.365, D5: 587.33, Eb5: 622.254, E5: 659.255, F5: 698.456, Gb5: 739.989, G5: 783.991, Ab5: 830.609, A5: 880, Bb5: 932.328, B5: 987.767,
    C6: 1046.502, Db6: 1108.731, D6: 1174.659, Eb6: 1244.508, E6: 1318.51, F6: 1396.913, Gb6: 1479.978, G6: 1567.982, Ab6: 1661.219, A6: 1760, Bb6: 1864.655, B6: 1975.533,
    C7: 2093.005, Db7: 2217.461, D7: 2349.318, Eb7: 2489.016, E7: 2637.021, F7: 2793.826, Gb7: 2959.955, G7: 3135.964, Ab7: 3322.438, A7: 3520, Bb7: 3729.31, B7: 3951.066
};


function startScale(){  // once the scale has started we let it complete
  //new plan: 8 oscillators, then a gainNode conected to them in sequence
  if (isScale) {
    isScale = false;
    if (!window.cancelAnimationFrame){
      window.cancelAnimationFrame = window.webkitCancelAnimationFrame;
    }
    window.cancelAnimationFrame( rafID );
    return "play scale";
  }
  
  else {
    isScale = true;
    audioContext = new AudioContext();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.connect(audioContext.destination);
    
    //scale playback parameters
    const tempo = 40; //beats per minute
    const tBeat = 60 / tempo; //seconds per beat
    const tTone = tBeat/4;  //tone sounds for a quarter of the scale note
    const trf = 0.01; //rise fall time of tone
    const toneOn=1; //on & off gains
    const toneOff=0.001;
    
    const scaleNotes = [notes.C4,notes.D4,notes.E4,notes.F4,notes.G4,notes.A4,notes.B4,notes.C5];
    
    var osc = new Array(8); //8 oscillators
    var gain = new Array(8); //gain blocks, to allow fade in/out
    //TODO - wrap this in a class - see https://medium.com/@danagilliann/an-introduction-to-creating-music-in-the-browser-with-web-audio-api-1a8d65cc2375
    osc[0] = audioContext.createOscillator();
    osc[1] = audioContext.createOscillator();
    osc[2] = audioContext.createOscillator();
    osc[3] = audioContext.createOscillator();
    osc[4] = audioContext.createOscillator();
    osc[5] = audioContext.createOscillator();
    osc[6] = audioContext.createOscillator();
    osc[7] = audioContext.createOscillator();
    
    //gain blocks
    gain[0] = audioContext.createGain();
    gain[1] = audioContext.createGain();
    gain[2] = audioContext.createGain();
    gain[3] = audioContext.createGain();
    gain[4] = audioContext.createGain();
    gain[5] = audioContext.createGain();
    gain[6] = audioContext.createGain();
    gain[7] = audioContext.createGain();

    //set osc frequencies and connect to gain blocks
    for(i=0; i<8; i++){
      osc[i].frequency.setValueAtTime(scaleNotes[i],audioContext.currentTime);
      osc[i].connect(gain[i]);
      osc[i].start();
      gain[i].gain.setValueAtTime(0,audioContext.currentTime);
      //gain[i].connect(audioContext.destination);
      gain[i].connect(audioContext.analyser);
    }
    
    //play
    let now = audioContext.currentTime;
    // NOW PLAY THE SCALE! Then stop
    for(i=0; i<8; i++){
      now = audioContext.currentTime;
      gain[i].gain.exponentialRampToValueAtTime(toneOn,  now+i*tBeat + trf);
      gain[i].gain.exponentialRampToValueAtTime(toneOff, now+i*tBeat + tTone+trf);
      
    }
    
    //isScale = false;
    //NEXT: ADD PITCH TO CHART ARRAY
    /* actually we have to have separate updatePitch for scale and for
    voice (live input) - cal them updatePitchScale and updatePitchVoice.
    Asynchronously there is a timer which updates the pitch from each source
    (if both Scale and Voice are active) and also the Chart
    
    TEST Chartt timer first - say at 100ms update rate
    
    HMM, MIGHT NOT BE TRUE
    So just try adding the pitch to the other used array
     - do this by connecting the oscillators to analyser, then analyser to destimation
    */
    updatePitch();

    return "stop";
    }
}
/************************************************ */

function toggleOscillator() {
  /**** This is now an FM source ***************/
    if (isOsc) {
        
        isOsc = false;
        oscillator.stop(0);
        modulator.stop(0);
        analyser = null;
        oscillaor = null;
        modulator = null;
        if (!window.cancelAnimationFrame) {
          window.cancelAnimationFrame = window.webkitCancelAnimationFrame;
        }
        window.cancelAnimationFrame( rafID );
        return "play oscillator";
    }
    else {
    isOsc = true;
    audioContext = new AudioContext();
    // frequency modulator
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    oscillator = audioContext.createOscillator();
    oscillator.frequency.value = 493.88; //B4

    modulator = audioContext.createOscillator();
    modulator.frequency.value=0.1;
    modulator.type = 'triangle';

    let modulationGain = audioContext.createGain();
    modulationGain.gain.value  = 100;

    /* connect everything up */
    modulator.connect(modulationGain);
    modulationGain.connect(oscillator.frequency);
    oscillator.connect(analyser);

    oscillator.start(0);
    modulator.start(0);
    
    analyser.connect( audioContext.destination );
    updatePitch();

    return "stop";
    }
}
/************************************************ */
/* TODO */
/** TOGGLE does not work - should change to use MediaStreamTrack
    which has a method to remove the track **/

function toggleVoiceInput() {
  if (isVoice) {  //switch off
        //stop playing and return
        //sourceNode.stop( 0 );
        //sourceNode = null;
        //analyser = null;
        if (!window.cancelAnimationFrame)
			window.cancelAnimationFrame = window.webkitCancelAnimationFrame;
        window.cancelAnimationFrame( rafID );
        isVoice = false;
    }
    else {
      isVoice = true;
      audioContext = new AudioContext();
      getAudio();
    }
}

/************************************************ */
var rafID = null;
var tracks = null;
var buflen = 1024;
var buf = new Float32Array( buflen );

var noteStrings = ["C4", "C#4", "D4", "D#4", "E4", "F4", "F#4", "G4", "G#4", "A4", "A#4", "B4"];


function frequencyFromNoteNumber( note ) {
	return 440 * Math.pow(2,(note-69)/12);
}

function centsOffFromPitch( frequency, note ) {
	return Math.floor( 1200 * Math.log( frequency / frequencyFromNoteNumber( note ))/Math.log(2) );
}
/************************************************ */

var MIN_SAMPLES = 0;  // will be initialized when AudioContext is created.
var MIN_AUDIO = 0.01;  // below this amplitude threshold we ignore the audio

var GOOD_ENOUGH_CORRELATION = 0.9; // this is the "bar" for how close a correlation needs to be
/************************************************ */
function autoCorrelate( buf, sampleRate ) {
  //NOTE: the sampleRate parameter passed here comes from the default for the analyser (using analyser.sampleRate)
	var SIZE = buf.length;
	var MAX_SAMPLES = Math.floor(SIZE/2);
	var best_offset = -1;
	var best_correlation = 0;
	var rms = 0;
	var foundGoodCorrelation = false;
	var correlations = new Array(MAX_SAMPLES);

	for (var i=0;i<SIZE;i++) {
		var val = buf[i];
		rms += val*val;
	}
	rms = Math.sqrt(rms/SIZE);
	if (rms<MIN_AUDIO) // not enough signal
		return -1;

	var lastCorrelation=1;
	for (var offset = MIN_SAMPLES; offset < MAX_SAMPLES; offset++) {
		var correlation = 0;

		for (var i=0; i<MAX_SAMPLES; i++) {
			correlation += Math.abs((buf[i])-(buf[i+offset]));
		}
		correlation = 1 - (correlation/MAX_SAMPLES);
		correlations[offset] = correlation; // store it, for the tweaking we need to do below.
		if ((correlation>GOOD_ENOUGH_CORRELATION) && (correlation > lastCorrelation)) {
			foundGoodCorrelation = true;
			if (correlation > best_correlation) {
				best_correlation = correlation;
				best_offset = offset;
			}
		} else if (foundGoodCorrelation) {
			
			var shift = (correlations[best_offset+1] - correlations[best_offset-1])/correlations[best_offset];

			return sampleRate/(best_offset+(8*shift));
		}
		lastCorrelation = correlation;
	}
	if (best_correlation > 0.01) {
		return sampleRate/best_offset;
	}
	return -1;
}



/*****************************************************/
//smoothing parameter for low pass filter in updatePitch
//parameters
var smoothing  = 5;       // or whatever is desired
var lastUpdate = new Date;


function updatePitch( time ) {
	var cycles = new Array;
	analyser.getFloatTimeDomainData( buf );
	var ac = autoCorrelate( buf, audioContext.sampleRate );
  console.log('ac',ac);
 	if (ac == -1) {
		//new - blank the chart y value
		isSquelched = true;
 	} else {
 	  isSquelched = false;

	 	pitch = ac;

     var noteFloat = 12 * (Math.log( pitch / 440 )/Math.log(2) )+69;
     
     var note = Math.round( noteFloat );
     //console.log('note', noteFloat, note);
		

    //send note to chart
    // first, fill up the table - if not isSquelched
    console.log('squelched?',isSquelched);
    if(!isSquelched){
      console.log('filling');
      if(timeAndNote.length < chart_table_length){
        timeAndNote.push([performance.now(),noteFloat]);
      }
      else { //TODO - add rate-independence by scaling smoothing variable
        // now filter the new value, depending on past filtered value
        // concept is from http://phrogz.net/js/framerate-independent-low-pass-filter.html
        lastValue = timeAndNote[chart_table_length - 1][1]; //last note
        timeAndNote.shift();                                //shift down
        var newValue = lastValue + (noteFloat-lastValue)/smoothing;
        timeAndNote.push([performance.now(),newValue]);      //filtered value
        console.log('raw',noteFloat,'filtered',newValue);
        //timeAndNote.push([performance.now(),noteFloat]);
      }
      

      //console.log(timeAndNote);
      if(chartReady){
        chartReady = false;
        drawChart();
    
      }
    
    }

	}
	if (!window.requestAnimationFrame)
		window.requestAnimationFrame = window.webkitRequestAnimationFrame;
	rafID = window.requestAnimationFrame( updatePitch );

	
}


//drawChart();
// CHART - the table needs to be updated with time

/************************************************ */

function drawChart() {
  console.log('drawchart');
  var data = google.visualization.arrayToDataTable(timeAndNote, true);
  //var range = [60,83]; //soprano

  var options = {
    title: 'note vs time',
    curveType: 'function',
    legend: { position: 'bottom' },
    hAxis: { //remove x axis clutter so it looks like a moving display
      ticks: [],
      gridlines: {color:'transparent'}
    },
    vAxis: {
      viewWindow: {min: 59, max: 81},
      
      ticks: [   // this table is based on Scientific Pitch Notation - which is NOT universal (some change the octave number at A!)
      {v: 60, f: 'C4'},
      {v: 61, f: 'C♯4/D♭4'},
      {v: 62, f: 'D4'},
      {v: 63, f: 'D♯4/E♭4'},
      {v: 64, f: 'E4'},
      {v: 65, f: 'F4'},
      {v: 66, f: 'F♯4/G♭4'},
      {v: 67, f: 'G5'},
      {v: 68, f: 'G♯4/A♭4'},
      {v: 69, f: 'A5'},
      {v: 70, f: 'A♯4/B♭4'},
      {v: 71, f: 'B4'},
      {v: 72, f: 'C5'},
      {v: 73, f: 'C♯5/D♭5'},
      {v: 74, f: 'D5'},
      {v: 75, f: 'D♯5/E♭5'},
      {v: 76, f: 'E5'},
      {v: 77, f: 'F5'},
      {v: 78, f: 'F♯5/G♭5'},
      {v: 79, f: 'G5'},
      {v: 80, f: 'G♯5/A♭5'},
      {v: 81, f: 'A5'},
      {v: 82, f: 'A♯5/G♭b5'},
      {v: 83, f: 'B5'},
      ]
    }
  };

  var chart = new google.visualization.LineChart(document.getElementById('curve_chart'));

    

        // Listen for the 'ready' event, and call my function readyHandler() when it's been drawn.
  google.visualization.events.addListener(chart, 'ready', readyHandler);

  chart.draw(data, options);
}
/************************************************ */

function readyHandler() {
          //console.log('readyHandler picked up the ready');
          chartReady = true;
          //drawChart();
        }

