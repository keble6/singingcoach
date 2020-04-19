/* This branch uses the Tartini pitch detector   */
/* TODOs */
/*
  Get restart for voice
  Button text index.html
  config for scales etc
*/


/************************ INITIALISATION ****************************/
//parameters for the chart table
const tTick = 300; //update rate of chart in ms
const chart_table_length=64;
var chartTime;
var chartReady = true;
var voiceArray = [60]; //initial chart tables
var scaleArray = [60];
var timeAndNote = [[performance.now(),60, 60],[performance.now()+tTick,60, 60]];

/****************** Audio ********************/
var buflen = 1024;
var bufScale = new Float32Array( buflen );
var bufVoice = new Float32Array( buflen );
bufVoice.fill(0.0);
var isVoice = false;
var isScale = false;
var analyserVoice = null;
var analyserScale = null;
var noteFloat = null;
var smoothing = 20; //the 1 value doesn't smooth at all

const constraints = window.constraints = {
  audio: true,
  video: false
};

/*** MISC ****/

/********************* SCALE Globals ****************************/
//scale playback parameters
const tempo = 40; //beats per minute
const tBeat = 60 / tempo; //seconds per beat
const tTone = tBeat/2;  //tone sounds for a quarter of the scale note
const trf = 0.005; //rise fall time of tone
const toneOn=1; //on & off gains
const toneOff=0.001;

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



/***************** START **********************/
// load the chart's Google code and then call drawChart function
google.charts.load('current', {'packages':['corechart']});
google.charts.setOnLoadCallback(UpdateLoop);

// The overall timing loop - runs every tTick ms
setInterval(UpdateLoop, tTick);

function UpdateLoop() {

  if(isScale || isVoice){
    chartTime=performance.now();
    if(isScale) {
      analyserScale.getFloatTimeDomainData( bufScale );
      var pitch = getPitch(bufScale,sampleRateScale);
      if (pitch != null){
        noteFloat = 12 * (Math.log( pitch / 440 )/Math.log(2) )+69;
      }
      else {
        noteFloat = null;
      }

      if(scaleArray.length < chart_table_length){
        scaleArray.push(noteFloat); //note value
      }
      else {
        lastValue = scaleArray[chart_table_length - 1]; //last note
        scaleArray.shift();                                //shift down
        var newValue = lastValue + (noteFloat-lastValue)/smoothing;
        scaleArray.push(newValue);      //filtered value
      }
      
    }
    if(isVoice) {
      
      analyserVoice.getFloatTimeDomainData( bufVoice );
      var pitch = getPitch(bufVoice,sampleRateVoice);
      if (pitch === null){
        noteFloat = null ;
      }
      else {
        noteFloat = 12 * (Math.log( pitch / 440 )/Math.log(2) )+69;
      }

      if(voiceArray.length < chart_table_length){
        voiceArray.push(noteFloat); //note value
      }
      /*else {  //apply filter, but don't filter if null is there
        lastValue = voiceArray[chart_table_length - 1]; //last note
        if(lastValue !== null && noteFloat !== null) {
          console.log('time', Math.round(chartTime), 'Voice note', noteFloat, lastValue);
          voiceArray.shift();   //shift down
          var newValue = lastValue + (noteFloat-lastValue)/smoothing;
          voiceArray.push(newValue);      //filtered value
        }
                         
      }*/
      else {  //no filtering for now - it's buggy (null etc)
        voiceArray.shift();   //shift down
        voiceArray.push(noteFloat);
        console.log('time', Math.round(chartTime), 'Voice note', noteFloat);
      }
      
    }
    drawChart();
  }
  
}


function playNote(audioContext,frequency, startTime, endTime) {
	  	gainNode = audioContext.createGain(); //to get smooth rise/fall
      oscillator = audioContext.createOscillator();
      oscillator.frequency.value=frequency;
      oscillator.connect(gainNode);
		  gainNode.connect(analyserScale); //analyser is global
		  analyserScale.connect(audioContext.destination);
      gainNode.gain.exponentialRampToValueAtTime(toneOn,  startTime + trf);
      gainNode.gain.exponentialRampToValueAtTime(toneOff, endTime+trf);
      oscillator.start(startTime);
      oscillator.stop(endTime);
    }
    
function startScale(){  // once the scale has started we let it complete (prefer to stop though)
  if (isScale) {
    //console.log('Scale stop'); //BUT the scale won't restart until it's fnished
    isScale = false;
    return "play scale";
  }
  else {
    //console.log('Scale start');
    isScale = true;
    audioContext = new AudioContext();
    sampleRateScale = audioContext.sampleRate;
    analyserScale = audioContext.createAnalyser();
    analyserScale.fftSize = 2048;
    analyserScale.connect(audioContext.destination);
    //the following scale notes will have to be user selectable
    // need to combine MIDI notes list in drawChart with notes list above
    const scaleNotes = [notes.C4,notes.D4,notes.E4,notes.F4,notes.G4,notes.A4,notes.B4,notes.C5];
    
    var  now = audioContext.currentTime;
    //play the scale (8 notes)
    for(var i=0; i<8; i++){
	    //console.log('start to play notes');
      playNote(audioContext,scaleNotes[i], now+i*tBeat, now + i*tBeat+tTone);
    }
    return "stop";
  }
}


function toggleVoiceInput() {
  if (isVoice) {  //switch off
  console.log('Voice stop');
    isVoice = false;
  }
  else {
    console.log('Voice start');
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


/*******************drawChart********************** */

function drawChart() {
  //now assemble the scale and voice arrays
  var voiceNote = voiceArray[voiceArray.length - 1];
  var scaleNote = scaleArray[scaleArray.length - 1];
  //console.log(scaleNote);
  //console.log(Math.round(currentTime), scaleNote);
  timeAndNote.push([chartTime, voiceNote, scaleNote]) ;
  var data = google.visualization.arrayToDataTable(timeAndNote, true);

  var options = {
    title: 'note vs time',
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
      viewWindow: {min: 46, max: 81},
      
      ticks: [   // this table is based on Scientific Pitch Notation - which is NOT universal (some change the octave number at A!)
      {v: 48, f: 'C3'},
      {v: 49, f: 'C♯3/D♭3'},
      {v: 50, f: 'D3'},
      {v: 51, f: 'D♯3/E♭3'},
      {v: 52, f: 'E3'},
      {v: 53, f: 'F3'},
      {v: 54, f: 'F♯3/G♭3'},
      {v: 55, f: 'G3'},
      {v: 56, f: 'G♯3/A♭3'},
      {v: 57, f: 'A3'},
      {v: 58, f: 'A♯3/B♭3'},
      {v: 59, f: 'B3'},
      {v: 60, f: 'C4'},
      {v: 61, f: 'C♯4/D♭4'},
      {v: 62, f: 'D4'},
      {v: 63, f: 'D♯4/E♭4'},
      {v: 64, f: 'E4'},
      {v: 65, f: 'F4'},
      {v: 66, f: 'F♯4/G♭4'},
      {v: 67, f: 'G5'},
      {v: 68, f: 'G♯4/A♭4'},
      {v: 69, f: 'A4'},
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

/********************** TARTINI CODDE ***********************/
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
    return null;
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
