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

//parameters for the chart table
var chart_table_length=64;
var chartReady = true;
var timeAndNote = [[performance.now(),60],[performance.now()+1,61]]; //initial chart table - we will fill it from upDate function

// load the chart's Google code and then call drawChart function
google.charts.load('current', {'packages':['corechart']});
google.charts.setOnLoadCallback(drawChart);

// now run
window.AudioContext = window.AudioContext || window.webkitAudioContext;

var isBlank=true; //true when audio intput is too low. It is set/reset by updatePitch, depending on ac from autoCorrelate()
var audioContext = null;
var isPlaying = false;
var oscillator = null;
var analyser = null;
var theBuffer = null;
var DEBUGCANVAS = null;
var mediaStreamSource = null;


/************************************************ */
/* functions for live input */
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
/************************************************ */

function toggleOscillator() {
  /**** This is now an FM source ***************/
    if (isPlaying) {
        analyser = null;
        isPlaying = false;
        return "play oscillator";
    }
    else {
    audioContext = new AudioContext();
    // frequency modulator
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    let oscillator = audioContext.createOscillator();
    oscillator.frequency.value = 493.88; //B4

    let modulator = audioContext.createOscillator();
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
    //sourceNode.start(0);
  
    isPlaying = true;
    isLiveInput = false;
    updatePitch();

    return "stop";
    }
}
/************************************************ */

function toggleLiveInput() {
  if (isPlaying) {  //switch off
        //stop playing and return
        sourceNode.stop( 0 );
        sourceNode = null;
        analyser = null;
        isPlaying = false;
    }
    else {
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
var MIN_AUDIO = 0.03;  // below this amplitude threshold we ignore the audio

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
  //console.log(ac);
 	if (ac == -1) {
		//new - blank the chart y value
		isBlank = true;
 	} else {
 	  isBlank = false;

	 	pitch = ac;

     var noteFloat = 12 * (Math.log( pitch / 440 )/Math.log(2) )+69;
     
     var note = Math.round( noteFloat );
     //console.log('note', noteFloat, note);
		

    //send note to chart
    // first, fill up the table - if not isBlank
    //console.log('blank?',isBlank);
    if(!isBlank){
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
  //console.log(blank);
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

