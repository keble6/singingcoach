/* This branch uses the Tartini pitch detector   */
/* TODOs */
/*
  Add time now on canvas DONE
  Get restart for voice DONE
  Button text index.html DONE
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
bufVoice.fill(1.0);
var isVoice = false;
var isScale = false;
var analyserVoice = null;
var analyserScale = null;
var noteFloat = null;
var smoothing = 5; //the 1 value doesn't smooth at all

const constraints = window.constraints = {
  audio: true,
  video: false
};

/*** MISC ****/

/********************* SCALE Globals ****************************/
//scale playback parameters
const tempo = 20; //beats per minute
const tBeat = 60 / tempo; //seconds per beat
const tTone = tBeat/2;  //tone sounds for a quarter of the scale note
const trf = 0.005; //rise fall time of tone
const toneOn=1; //on & off gains
const toneOff=0.001;

/*************** notes array************/
/* names of the notes in sequence ******/
/*** first item is MIDI note 12  *******/
const notes = [
    'C0','Db0','D0','Eb0', 'E0', 'F0', 'Gb0', 'G0', 'Ab0', 'A0', 'Bb0', 'B0',
    'C1','Db1','D1','Eb1', 'E1', 'F1', 'Gb1', 'G1', 'Ab1', 'A1', 'Bb1', 'B1',
    'C2','Db2','D2','Eb2', 'E2', 'F2', 'Gb2', 'G2', 'Ab2', 'A2', 'Bb2', 'B2',
    'C3','Db3','D3','Eb3', 'E3', 'F3', 'Gb3', 'G3', 'Ab3', 'A3', 'Bb3', 'B3',
    'C4','Db4','D4','Eb4', 'E4', 'F4', 'Gb4', 'G4', 'Ab4', 'A4', 'Bb4', 'B4',
    'C5','Db5','D5','Eb5', 'E5', 'F5', 'Gb5', 'G5', 'Ab5', 'A5', 'Bb5', 'B5',
    'C6','Db6','D6','Eb6', 'E6', 'F6', 'Gb6', 'G6', 'Ab6', 'A6', 'Bb6', 'B6',
    'C7','Db7','D7','Eb7', 'E7', 'F7', 'Gb7', 'G7', 'Ab7', 'A7', 'Bb7', 'B7'
    
];


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
      pitch = getPitch(bufScale,sampleRateScale);
      if (pitch === 0.0 || pitch == -1 || !isFinite(pitch)) {  //catch bad pitch values
        noteFloat = null ;
      }
      else {
        noteFloat = 12 * (Math.log( pitch / 440 )/Math.log(2) )+69;
      }
      scaleArray.push(noteFloat); //note value
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
  
}

/************* GetRange() **********/
// get selected vocal range in HTML page

function getRange(){
  var ele = document.getElementsByName('range');
              
  for(i = 0; i < ele.length; i++) {
    if(ele[i].checked){
      var range = ele[i].value;
      console.log('range = ',range);
    }
  }
}

/************ playNote (for scale mode) ***********/
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
    document.querySelector('#scale').textContent=
   'start scale';
    isScale = false;
    return;
  }
  else {
    document.querySelector('#scale').textContent=
   'stop scale';
    isScale = true;
    audioContext = new AudioContext();
    sampleRateScale = audioContext.sampleRate;
    analyserScale = audioContext.createAnalyser();
    analyserScale.fftSize = 2048;
    analyserScale.connect(audioContext.destination);
    //the following scale notes will have to be user selectable
    // need to combine MIDI notes list in drawChart with notes list above
    
    //Cmaj for soprano
    const scaleNotes = [60, 62, 64, 65, 67, 69, 71, 72, 71, 69, 67, 65, 64, 62, 60];
    
    var  now = audioContext.currentTime;
    //play the scale (15 notes, up and down)
    for(var i=0; i<16; i++){
      playNote(audioContext,frequencyFromNoteNumber(scaleNotes[i]), now+i*tBeat, now + i*tBeat+tTone);
    }
    return "stop";
  }
}


function toggleVoiceInput() {
  if (isVoice) {  //switch off
  document.querySelector('#voice').textContent=
   'start voice input';
  console.log('Voice stop');
    isVoice = false;
  }
  else {
    document.querySelector('#voice').textContent=
   'stop voice input';
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
  document.getElementById("time").innerHTML = Math.round(chartTime/1000.0) ;
  //now assemble the scale and voice arrays
  var voiceNote = voiceArray[voiceArray.length - 1];
  var scaleNote = scaleArray[scaleArray.length - 1];
  //console.log(scaleNote);
  //console.log(Math.round(currentTime), scaleNote);
  timeAndNote.push([chartTime, voiceNote, scaleNote]) ;
  var data = google.visualization.arrayToDataTable(timeAndNote, true);

  var options = {
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
      viewWindow: {min: 56, max: 88},
      //soprano scale C4-C6 with 4 notes each side
      ticks: [   // this table is based on Scientific Pitch Notation - which is NOT universal (some change the octave number at A!)
      {v: 56, f: notes[56-12]},
      {v: 57, f: notes[57-12]},
      {v: 58, f: notes[58-12]},
      {v: 59, f: notes[59-12]},
      {v: 60, f: notes[60-12]},
      {v: 61, f: notes[61-12]},
      {v: 62, f: notes[62-12]},
      {v: 63, f: notes[63-12]},
      {v: 64, f: notes[64-12]},
      {v: 65, f: notes[65-12]},
      {v: 66, f: notes[66-12]},
      {v: 67, f: notes[67-12]},
      {v: 68, f: notes[68-12]},
      {v: 69, f: notes[69-12]},
      {v: 70, f: notes[70-12]},
      {v: 71, f: notes[71-12]},
      {v: 72, f: notes[72-12]},
      {v: 73, f: notes[73-12]},
      {v: 74, f: notes[74-12]},
      {v: 75, f: notes[75-12]},
      {v: 76, f: notes[76-12]},
      {v: 77, f: notes[77-12]},
      {v: 78, f: notes[78-12]},
      {v: 79, f: notes[79-12]},
      {v: 80, f: notes[80-12]},
      {v: 81, f: notes[81-12]},
      {v: 82, f: notes[82-12]},
      {v: 83, f: notes[83-12]},
      {v: 84, f: notes[84-12]},
      {v: 85, f: notes[85-12]},
      {v: 86, f: notes[86-12]},
      {v: 87, f: notes[87-12]},
      {v: 88, f: notes[88-12]},
      ]
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
/**** chnaged to return 0 instead of null for bad case ****/
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
