/**
 * The controller for the sequencing application.
 * Manages state and keeps the views updated.
 */
this.Sequencer = Class.define({

  // TODO: move colors to launchpad (like GUI)
  GRID_COLORS:[
    Launchpad.color(0,0), // off
    Launchpad.color(3,0), // green
    Launchpad.color(3,2), // yellow
    Launchpad.color(2,3), // orange
    Launchpad.color(0,3)  // red
  ],

  STEP_COLOR: Launchpad.color(1,1), // color for current sequencer step, regardless of value
  TRACK_COLOR: Launchpad.color(1,2),
  PATTERN_COLOR: Launchpad.color(2,0),

  init: function(launchpad, output, gui) {
    this.launchpad = launchpad;
    this.output = output;
    this.gui = gui;

    this.track = 0; // selected track index
    this.pattern = 0; // selected pattern index
    this.value = 1;
    this.clock = -1;

    var tracks = [];
    for(var t=0; t<TRACKS; t++) {
      tracks.push( new Track() );
    }
    this.tracks = tracks;

    this._updateSelectedPattern();

    // TODO: can we do this in a more direct, and efficient, way?
    var call = this;
    launchpad.on('topDown', function(index) {
      if(index <= 3) { // left 4 top buttons
        call.selectTrack(index);
      } else {         // right 4
        call.selectValue(index-3);
      }
    });
    launchpad.on('rightDown', function(idx){ call.selectPattern(idx); });
    launchpad.on( 'gridDown', function(x,y){ call.setGridValue( x,y); });
  },


  //==============================================================================

  /**
   * Update the Launchpad and Max GUI lights to reflect the current sequencer state
   */
  reset: function() {
    this.launchpad.allOff();
    this.gui.clearGrid();

    this.setClock(this.clock);
    this.selectValue(this.value, true);
    this.selectTrack(this.track, true);
    this.selectPattern(this.pattern);
  },

  setGridValue: function(x,y) {
    var step = x + y*8,
        selectedPattern = this.selectedPattern,
        value = this.value;

    if(value === selectedPattern.get(step)) value = 0; // toggle off
    selectedPattern.setStep(step, value);

    this.launchpad.grid(x, y, this.GRID_COLORS[value]);
    this.gui.grid(x, y, value);
  },

  selectTrack: function(index, skipRedraw) {
    if(index >= 0 && index <= 3) {
      this.launchpad.top(this.track, 0);
      this.track = index;
      this.launchpad.top(index, this.TRACK_COLOR);
      this._updateSelectedPattern(skipRedraw);
      this.gui.track(index);
    }
  },

  selectedTrack: function() {
    return this.tracks[this.track];
  },

  selectValue: function(value, preventToggle) {
    if(value >= 0 && value <= 4) {
      var oldValue = this.value;

      if(oldValue !== 0) { // hide old value:
        this.launchpad.top(this.value+3, 0);
      }
      if(oldValue === value && !preventToggle) { // toggle
        value = 0
      }
      this.value = value;

      // show new value
      if(value !== 0) this.launchpad.top(value+3, this.GRID_COLORS[value]);
      this.gui.stepValue(value);
    }
  },

  selectPattern: function(index, skipRedraw) {
    if(index >= 0 && index <= 7) {
      this.launchpad.right(this.pattern, 0);
      this.pattern = index;
      this.launchpad.right(index, this.PATTERN_COLOR);
      this.gui.pattern(index);
      this._updateSelectedPattern(skipRedraw);
    }
  },

  setClock: function(clock) {
    var oldClock = this.clock;
    if(oldClock !== clock) {
      this.clock = clock;

      // a negative clock is inactive, and no updates are needed
      if(oldClock >= 0) {
        var oldX = oldClock % 8,
            oldY = Math.floor(oldClock/8) % 8,
            oldValue = this.selectedPattern.get(oldClock),
            oldColor = this.GRID_COLORS[oldValue];

        // update GUI to remove oldClock indicator
        this.launchpad.grid(oldX, oldY, oldColor);
        this.gui.grid(oldX, oldY, oldValue);
        // TODO: be careful, this likely won't work once we allow for changing start & end steps per pattern
      }

      if(clock >= 0) {
        var output = this.output,
            x = clock % 8,
            y = Math.floor(clock/8) % 8,
            color = this.STEP_COLOR;

        // show the new clock indicator
        this.launchpad.grid(x, y, color);
        this.gui.grid(x, y, 5);

        // generate MIDI output for current step
        for(var t=0; t<TRACKS; t++) {
          var track = this.tracks[t],
              patterns = track.patterns;
//        for(var p=0; p<PATTERNS; p++) {
//          var step = pattern.get(clock);
//          if(step > 0) { // a simple filter for preliminary testing. TODO: interpret what these patterns mean
//            output(t,p, track.basePitch+step);
//          }

          // for now, just hardcoding, first pattern is gate, second is velocity, and third is pitch
          var gate = patterns[0].get(clock);
          if(gate > 0) {
            var velocity, duration;
                velocityValue = patterns[1].get(clock),
                pitch = track.basePitch + patterns[2].get(clock);

            switch(velocityValue) {
              case 0: velocity = 100; break;
              case 1: velocity = 127; break;
              case 3: velocity =  70; break;
              case 4: velocity =  50; break;
              default: velocity = 85; break;

            }

            switch(gate) {
              case 1: duration = 0.5; break;
              case 3: duration = 2; break;
              case 4: duration = 4; break;
              default: duration = 1;
            }

            output(pitch, velocity, duration);
          }
        }
      }
    }
  },

  /**
   * @param t the track index
   * @param p the pattern index
   * @param stepValues an array of sequence step values
   */
  setPattern: function(t, p, stepValues) {
    if(t<0 || t>=TRACKS || p<0 || p>=PATTERNS || stepValues.length!==64) return; // invalid input

    this.tracks[t].patterns[p].sequence = stepValues;

    if(t === this.track && p === this.pattern) { // update current pattern
      this._drawPattern(t, p);
    }
  },

  /**
   * output the state of the sequencing application.
   */
  writeState: function(trackOut, patternOut) {
    for(var t=0; t<TRACKS; t++) {
      var track = this.tracks[t];
      trackOut(t, track);

      for(var p=0; p<PATTERNS; p++) {
        var pattern = track.patterns[p];
        patternOut(t, p, pattern);
      }
    }
  },


  //==============================================================================
  // private

  _updateSelectedPattern: function(skipRedraw) {
    this.selectedPattern = this.tracks[this.track].patterns[this.pattern];
    if(!skipRedraw) this._drawPattern(this.track, this.pattern);
  },

  _drawPattern: function(trackIndex, patternIndex) {
    var track = this.tracks[trackIndex];
    var pattern = track ? track.patterns[patternIndex] : null;
    if(!pattern) return;

    for(var x=0; x<ROW_LENGTH; x++) {
      for(var y=0; y<ROW_LENGTH; y++) {
        var step = x + y*ROW_LENGTH;
        var value = pattern.get(step);

        this.launchpad.grid(x, y, this.GRID_COLORS[value]);
        this.gui.grid(x, y, value);
      }
    }
    this.gui.trackInfo(trackIndex, track);
    this.gui.patternInfo(patternIndex, pattern);
  }

});