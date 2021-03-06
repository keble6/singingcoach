/* This app uses the Tartini pitch detector                */
/* at https://github.com/bojan88/WASM-vs-JS-Pitch-detector */
/*
Copyright 2020 Rob Wilson

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/* TODOs: fix(es) to allow webAudio on iPads */


/************************ INITIALISATION ****************************/
//parameters for the chart table

const chart_table_length=128;
var chartTime;
var chartReady = true;
var voiceArray = [60]; //initial chart tables
var scaleArray = [60];
var timeAndNote = [[performance.now(),60, 60],[performance.now()+tTick,60, 60]];
var vAxisTicks={};  //y axis objects that will be changed with vocal range
var viewWindowMin, viewWindowMax;
const vAxisMargin = 4; //show this number of notes above and below the vocal range

/****************** Audio ********************/
var buflen = 1024;
var bufScale = new Float32Array( buflen );
var bufVoice = new Float32Array( buflen );
bufVoice.fill(1.0);
var isVoice = false;
var isScale = false;
var analyserVoice = null;
var analyserScale = null;
var noteFloat = null;
var smoothing = 2; //the 1 value doesn't smooth at all

const constraints = window.constraints = {
  audio: true,
  video: false
};

/*** MISC ****/

/********************* SCALE Globals ****************************/
//scale playback parameters
var scaleNotes=[];
const trf = 0.005; //rise fall time of tone
const toneOn=1; //on & off gains
const toneOff=0.001;

/*************** notes array************/
/* names of the notes in sequence ******/
/*** first (0th) item is MIDI note 12  *******/
const notes = [
    'C0','C#/Db0','D0','D#/Eb0', 'E0', 'F0', 'F#/Gb0', 'G0', 'G#/Ab0', 'A0', 'A#/Bb0', 'B0',
    'C1','C#/Db1','D1','D#/Eb1', 'E1', 'F1', 'F#/Gb1', 'G1', 'G#/Ab1', 'A1', 'A#/Bb1', 'B1',
    'C2','C#/Db2','D2','D#/Eb2', 'E2', 'F2', 'F#/Gb2', 'G2', 'G#/Ab2', 'A2', 'A#/Bb2', 'B2',
    'C3','C#/Db3','D3','D#/Eb3', 'E3', 'F3', 'F#/Gb3', 'G3', 'G#/Ab3', 'A3', 'A#/Bb3', 'B3',
    'C4','C#/Db4','D4','D#/Eb4', 'E4', 'F4', 'F#/Gb4', 'G4', 'G#/Ab4', 'A4', 'A#/Bb4', 'B4',
    'C5','C#/Db5','D5','D#/Eb5', 'E5', 'F5', 'F#/Gb5', 'G5', 'G#/Ab5', 'A5', 'A#/Bb5', 'B5',
    'C6','C#/Db6','D6','D#/Eb6', 'E6', 'F6', 'F#/Gb6', 'G6', 'G#/Ab6', 'A6', 'A#/Bb6', 'B6',
    'C7','C#/Db7','D7','D#/Eb7', 'E7', 'F7', 'F#/Gb7', 'G7', 'G#/Ab7', 'A7', 'A#/Bb7', 'B7'
    
];


/***************** START **********************/

generateVaxisObjs(range); //construct the objects for chart axis
getScale(octave);


function getRange(clicked) { //this gets called when user changes vocal range
  range=clicked;
  getScale(octave);
  generateVaxisObjs(range);
}

// after load, start the chart update loop
google.charts.setOnLoadCallback(UpdateLoop);

/********* The overall timing loop - runs every tTick ms ***********/
setInterval(UpdateLoop, tTick); //this clock uses ms! tTick is defined in index.html file

function UpdateLoop() {
  var t0 = performance.now();

  if(isScale || isVoice){
    chartTime=performance.now();
    
    if(octaveChanged){  //update scale notes and chart axis
      getScale(octave);
      generateVaxisObjs(range);
      octaveChanged=false;
    }

    
    if(isScale) {
      //plot scale when the audio time is right
      var currentTime = audioContext.currentTime;

      while (oscsStartTimes.length && oscsStartTimes[0].time < currentTime) {
        currentNote = oscsStartTimes[0].note; //this will be plotted on chart
        //console.log('current note ', currentNote);
        oscsStartTimes.splice(0,1);   // remove note from queue
      }
      
      scaleArray.push(currentNote); //note value
    }

    if(isVoice) {
      analyserVoice.getFloatTimeDomainData( bufVoice );
      pitch = getPitch(bufVoice,sampleRateVoice);
      if (pitch === 0.0 || pitch == -1 || !isFinite(pitch)) {  //catch bad pitch values
        noteFloat = null ;
      }
      else {
        noteFloat = 12 * (Math.log( pitch / 440 )/Math.log(2) )+69;
      }
        
      if(voiceArray.length < chart_table_length){
        voiceArray.push(noteFloat); //note value
      }
      else {  //apply filter, but don't filter if null is there
        lastValue = voiceArray[chart_table_length - 1]; //last note
        if(lastValue !== null && noteFloat !== null) {
          voiceArray.shift();   //shift down
          newValue = lastValue + (noteFloat-lastValue)/smoothing;
          voiceArray.push(newValue);      //filtered value
        }
                         
      }
      
    }
    drawChart();
  }
  var t1 = performance.now();
  //console.log('loop took :', t1-t0);
  
}

/*** generate the notes for the scales for each range **/
function getScale(octave) {
  switch(range) {
  case("soprano"):    start=60; break;
  case("mezzo"):      start=57; break;
  case("contralto"):  start=53; break;
  case("tenor"):      start=47;
  }
  //assemble the basic major scale (steps are 2, 2, 1, 2, 3, 1)
  scaleNotes=[start];
  scaleNotes.push(start+2,start+4, start+5, start+7, start+9, start+11, start+12);

  //now add the down sections
  switch(octave) {
    case("lower"):  for(var i=0; i<7; i++)
      scaleNotes.push(scaleNotes[6-i]); break;
    case("upper"):  for(i=0; i<8; i++) scaleNotes[i]=scaleNotes[i]+12;
      for(i=0; i<7; i++) scaleNotes.push(scaleNotes[6-i]); break;
    case("both"):  for(i=0; i<7; i++) scaleNotes.push(scaleNotes[i+1]+12);
      for(i=0; i<7; i++) scaleNotes.push(scaleNotes[6-i]+12);
      for(i=0; i<7; i++) scaleNotes.push(scaleNotes[6-i]); break;
  }
}

var oscs = []; //list of oscillators
var oscsStartTimes = []; // and their start times

/************ playNote (for scale mode) ***********/
function playNote(audioContext,note, startTime, endTime, last, index) {
	gainNode = audioContext.createGain(); //to get smooth rise/fall
	
	oscillator = audioContext.createOscillator();
  oscillator.frequency.value=frequencyFromNoteNumber(note);
  oscillator.connect(gainNode);
  //code to keep track of alll the oscs so that they can be switched off if scale is stopped by user
	oscs[index] = oscillator;
	oscsStartTimes.push({note: note, time: startTime}); //list of start times for chart
	
	gainNode.connect(analyserScale); //analyser is global
	analyserScale.connect(audioContext.destination);
  gainNode.gain.exponentialRampToValueAtTime(toneOn,  startTime + trf);
  gainNode.gain.exponentialRampToValueAtTime(toneOff, endTime+trf);
  oscillator.start(startTime);
  oscillator.stop(endTime);
  
  if(last){
    oscillator.onended=function(){
    //console.log('last tone finished');
      stopScaleButton();
    }
  }
}

function stopScaleButton(){ //change colour & text of button, change flag
  document.querySelector('#scale').textContent='start scale';
  document.getElementById("scale").style.backgroundColor = "GhostWhite";
  isScale = false;
  // code to stop any scheduled scale notes
  for(let i=0; i<oscs.length; i++) {
    if(oscs[i]){
      oscs[i].stop(0);
    }
  }
  oscsStartTimes=[]; //reset array for plotting
}
function startScaleButton(){
  document.querySelector('#scale').textContent='stop scale';
  document.getElementById("scale").style.backgroundColor = "yellow";
  isScale = true;
}

function toggleScale(){  //stasrt or stop scale playing
  if (isScale) {
    stopScaleButton();
    return;
  }
  else {
    var last = false;
    startScaleButton();
    //initial chart point
    timeAndNote = [[performance.now(),60, scaleArray[0]]];
    
    audioContext = new AudioContext();
    sampleRateScale = audioContext.sampleRate;
    analyserScale = audioContext.createAnalyser();
    analyserScale.fftSize = 2048;
    analyserScale.connect(audioContext.destination);
    
    var  now = audioContext.currentTime;
    //play the scale
    for(var i=0; i<scaleNotes.length; i++){
      if(i==scaleNotes.length-1){
        last=true;  //use this to signal last tone
      }
      //pass note number now, convert to frequency in function
      playNote(audioContext,scaleNotes[i], now+i*tBeat, now + i*tBeat+tTone, last, i);
      //console.log('range', range,'note',scaleNotes[i] );
    }
    return;
  }
}


function toggleVoiceInput() {
  if (isVoice) {  //switch off
  document.querySelector('#voice').textContent=
   'start voice';
   document.getElementById("voice").style.backgroundColor = "GhostWhite";
    isVoice = false;
  }
  else {
    document.querySelector('#voice').textContent=
   'stop voice';
   document.getElementById("voice").style.backgroundColor = "yellow";
    //console.log('Voice start');
    isVoice = true;
    audioContext = new AudioContext();
    sampleRateVoice = audioContext.sampleRate;
    //get the audio stream
    navigator.mediaDevices.getUserMedia(constraints).then(gotStream).catch(error);
  }
}

/* functions for voice input */
function error() {
    const errorMessage = 'navigator.MediaDevices.getUserMedia error: ' + error.message + ' ' + error.name;
  //console.log(errorMessage);
}

/*********Voice input setup********** */
function gotStream(stream) {
  //console.log('in gotStream');
  const audioTracks = stream.getAudioTracks();

  //console.log('Using audio device: ' + audioTracks[0].label);
  stream.oninactive = function() {
    //console.log('Stream ended');
  };
  window.stream = stream; // make variable available to browser console
  // Create an AudioNode from the stream.
    mediaStreamSource = audioContext.createMediaStreamSource(stream);
    // Connect it to the destination.
    analyserVoice = audioContext.createAnalyser();
    //console.log('analyserVoice created');
    analyserVoice.fftSize = 2048;
    mediaStreamSource.connect( analyserVoice );
}

function frequencyFromNoteNumber( note ) {
	return 440 * Math.pow(2,(note-69)/12);
}


function generateVaxisObjs(range) { //this generates the vAxisTicks objects for chart
  var startTick;
  
  switch (range) {
    case "soprano": startTick=60-vAxisMargin; break;//start at note C4
    case "mezzo": startTick=57-vAxisMargin; break;
    case "contralto": startTick=53-vAxisMargin; break;
    case "tenor": startTick=47-vAxisMargin; break;
  }
  viewWindowMin = startTick;  //variables will be used in drawChart to limit y axis
  viewWindowMax = startTick+24+2*vAxisMargin;
  
  // vAxisTicks has the format: [{v: 56, f: notes[56-12]},...] for Google Charts
  var rangeNotes=[];
  for (let i = startTick; i < (startTick+24+2*vAxisMargin); i++){ //2 octaves with 4 notes either side
    rangeNotes[i] = notes[i-12];
  }
  vAxisTicks = Object.entries(rangeNotes).map(([key,val]) => {
    return {v: key, f: val}
  });
}
      

      
/*******************drawChart********************** */

function drawChart() {
  document.getElementById("time").innerHTML = Math.round(chartTime/1000.0) ;
  //now assemble the scale and voice arrays
  var voiceNote = voiceArray[voiceArray.length - 1];
  var scaleNote = scaleArray[scaleArray.length - 1];
  timeAndNote.push([chartTime, voiceNote, scaleNote]) ;
  var data = google.visualization.arrayToDataTable(timeAndNote, true);

  var options = {
    chartArea: {left: 80,top:0},
    //title: 'note vs time',
    curveType: 'none',
    legend: { position: 'bottom' },
    hAxis: { //remove x axis clutter so it looks like a moving display
      ticks: [],
      gridlines: {color:'transparent'},
      viewWindow: { //this gives a "moving" chart
        min: chartTime-64*tTick,
        max: chartTime
      },
    },
    vAxis: {
      viewWindow: {min: viewWindowMin, max: viewWindowMax},
      ticks: vAxisTicks, //this is an array that depends on the selected (vocal) range
    }
  };

  var chart = new google.visualization.LineChart(document.getElementById('curve_chart'));

  google.visualization.events.addListener(chart, 'ready', readyHandler);

  chart.draw(data, options);
}
/************************************************ */

function readyHandler() {
          //console.log('readyHandler picked up the ready');
          chartReady = true;
          //drawChart();
        }

/********************** TARTINI CODDE ***********************/
/**** changed to return 0 instead of null for bad case ****/
onmessage = function(e) {
  const startTime = performance.now();
  const pitch = getPitch(new Float32Array(e.data.buffer), e.data.sampleRate);
  const execTime = performance.now() - startTime;

  postMessage({pitch, execTime});
}

const LOWER_PITCH_CUTOFF = 20.0;
const SMALL_CUTOFF = 0.5;
const CUTOFF = 0.93;

function getPitch(buffer, sampleRate) {
  const nsdf = normalizedSquareDifference(buffer);
  const maxPositions = peakPicking(nsdf);
  const estimates = [];

  let highestAmplitude = Number.MIN_SAFE_INTEGER;

  for(let i of maxPositions) {
    highestAmplitude = Math.max(highestAmplitude, nsdf[i]);
    if (nsdf[i] > SMALL_CUTOFF) {
      let est = parabolicInterpolation(nsdf, i);
      estimates.push(est);
      highestAmplitude = Math.max(highestAmplitude, est[1]);
    }
  }

  if(estimates.length === 0) {
    return 0.0; //was null
  }

  const actualCutoff = CUTOFF * highestAmplitude;
  let period = 0.0;

  for(est of estimates) {
    if(est[1] >= actualCutoff) {
      period = est[0];
      break;
    }
  }

  const pitchEst = sampleRate / period;

  return pitchEst > LOWER_PITCH_CUTOFF ? pitchEst : -1;
}

function peakPicking(nsdf) {
  const maxPositions = [];
  let pos = 0;
  let curMaxPos = 0;
  const len = nsdf.length;

  while(pos < (len - 1) / 3 && nsdf[pos] > 0.0) {
    pos++;
  }
  while(pos < len - 1 && nsdf <= 0.0) {
    pos++;
  }

  if(pos === 0) {
    pos = 1;
  }

  while(pos < len -1) {
    if(nsdf[pos] < nsdf[pos - 1] && nsdf[pos] >= nsdf[pos + 1]) {
      if(curMaxPos === 0) {
        curMaxPos = pos;
      } else if(nsdf[pos] > nsdf[curMaxPos]) {
        curMaxPos = pos;
      }
    }

    pos++;

    if(pos < len - 1 && nsdf[pos] <= 0.0) {
      if(curMaxPos > 0) {
        maxPositions.push(curMaxPos);
        curMaxPos = 0;
      }
      while(pos < len - 1 && nsdf <= 0.0) {
        pos++;
      }
    }
  }

  if(curMaxPos > 0) {
    maxPositions.push(curMaxPos);
  }

  return maxPositions;
}

function normalizedSquareDifference(buffer) {
  const len = buffer.length;
  const nsdf = new Array(len).fill(0.0);

  for(let tau = 0; tau < len; tau++) {
    let acf = 0.0;
    let divisorM = 0.0;

    for(let i = 0; i < len - tau; i++) {
      acf += buffer[i] * buffer[i + tau];
      let el1 = buffer[i];
      let p1 = Math.pow(el1, 2);
      let el2 = buffer[i + tau];
      let p2 = Math.pow(el2, 2);
      divisorM += p1 + p2;
    }

    nsdf[tau] = 2.0 * acf / divisorM;
  }

  return nsdf;
}

function parabolicInterpolation(nsdf, tau) {
  const nsdfa = nsdf[tau - 1];
  const nsdfb = nsdf[tau];
  const nsdfc = nsdf[tau + 1];
  const bottom = nsdfc + nsdfa - 2.0 * nsdfb;

  if(bottom === 0.0) {
    return [tau, nsdfb]
  } else {
    let delta = nsdfa - nsdfc;
    return [
      tau + delta / (2.0 * bottom),
      nsdfb - delta * delta / (8.0 * bottom)
    ]
  }
}
