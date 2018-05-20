var EVENT_TITLE_STRETCH = "Stretch";
var EVENT_TITLE_SNACK = "Snack";
var CALENDAR_NAME_RUN = "Run";
var CALENDAR_NAME_RUN_UC = CALENDAR_NAME_RUN.toUpperCase();
var EVENT_TITLE_RUN_UC = "RUN"; // used for simle search of event titles
var EVENT_TITLE_YOGA_UC = "YOGA";

var OUTSIDE_EVENT_COLOR = "7"; // used to trigger things on this script.

function Install() {
  ScriptApp.newTrigger("processRunsImmediate")
  .timeBased().everyHours(1).create();
  ScriptApp.newTrigger("processRunsFuture")
  .timeBased().everyDays(1).create();
}

function Uninstall() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i=0; i<triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
}

function processRunsToday() {
  // useful manual execution, focus on a single day
  processRuns(0);
}

function processRunsImmediate() {
  // today and tomorrow
  processRuns(0);
  processRuns(1);
}

function processRunsFuture() {
  // day after tomorrow, up to 10 days
  for (var i = 2; i < 10; i++) {
    processRuns(i);
  }
}

function processRuns(daysFromToday) {
  var calendars = CalendarApp.getAllOwnedCalendars();
  var now = new Date();
  var date = new Date(Date.now() + 1000*60*60*24*daysFromToday); 
  
  var run_cal, run_start, run_end;
  
  // find the run calendar first.  this is where snack and stretch are managed.
  for (var i = 0; i < calendars.length; i++) {
    var c = calendars[i];
    
    if (c.getName().toUpperCase() == CALENDAR_NAME_RUN_UC) {
      run_cal = c;
    }
  }
  
  // find any run events in any calendar
  for (var i = 0; i < calendars.length; i++) {
    var c = calendars[i];
    
    // find a run for target day..
    var events = c.getEventsForDay(date);
    
    for (var j = 0; j < events.length; j++) {
      var e = events[j];
      var is_run = false;
      var is_yoga = false;

      if (e.getColor() == OUTSIDE_EVENT_COLOR) {
        var t = e.getTitle();
        Logger.log("Event: " + date.getDay() + " " + t);
        
        var tUC = t.toUpperCase();
        if (tUC.indexOf(EVENT_TITLE_RUN_UC) > -1) {
          is_run = true;
          
          // can't process a run if we don't have a run calendar
          if (run_cal == null) {
            throw new Error("No calendar named 'Run' found.");
          }
          
          if (run_start == null || e.getStartTime().getTime() < run_start.getTime()) {
            run_start = e.getStartTime();
          }
          
          if (run_end == null || run_end.getTime() < e.getEndTime().getTime()) {
            run_end = e.getEndTime();
          }
          
          Logger.log("Found a '" + EVENT_TITLE_RUN_UC + "': " + t);
        } else if (tUC.indexOf(EVENT_TITLE_YOGA_UC) > -1) {
          is_yoga = true;
        }
        
        // don't update the event if it's in the past.  
        // NOTE weather forecasts are hourly and do not provide the current hour.
        //      therfore, if event starts within the current hour, there will be no forecast available.
        //      this check must exclude minutes and seconds for the target start date
        var x = e.getStartTime();
        x.setMinutes(0);
        x.setSeconds(0);
        if (now.getTime() <= x.getTime()) {
          // set norms for run and yoga events
          if (is_yoga || is_run) {
            setEventNorms(e);
          }
          
          // set emoji and what to wear stuff
          processWeatherForRunEvent(e, is_run);
        }
      }
    }
  }
  
  // have run start & end times (min & max).  process!
  // setup snack & stretch:
  if (is_run && run_start != null && run_end != null) {
    setSnackAndStretchFor(run_cal, run_start, run_end);
  } else {
    deleteSnackFor(run_cal, date);
    deleteStretchFor(run_cal, date);
  }
}

function findEventFor(run_cal, date, title) {
  var events = run_cal.getEventsForDay(date);
  var search = title.toUpperCase();
  
  for (var j = 0; j < events.length; j++) {
    var e = events[j];
    
    // find event by name, ignore case
    var tUC = e.getTitle().toUpperCase();
    if (tUC == search) {
      return e;
    }
  }
}

function deleteSnackFor(run_cal, date) {
  var snack = findEventFor(run_cal, date, EVENT_TITLE_SNACK);
  
  while (snack != null) {
    snack.deleteEvent();
    snack = findEventFor(run_cal, date, EVENT_TITLE_SNACK);
  }
}

function deleteStretchFor(run_cal, date) {
  var stretch = findEventFor(run_cal, date, EVENT_TITLE_STRETCH);
  
  while (stretch != null) {
    stretch.deleteEvent();
    stretch = findEventFor(run_cal, date, EVENT_TITLE_STRETCH);
  }
}

/**
* Params:
* run - Event representing the run
* run_cal - the "run" calendar (where snack and stretch are managed)
*/
function setSnackAndStretchFor(run_cal, run_start, run_end) {
  var snack = findEventFor(run_cal, run_start, EVENT_TITLE_SNACK);
  var stretch = findEventFor(run_cal, run_start, EVENT_TITLE_STRETCH);
  
  var snack_offset_time = 2 * 60 * 60 * 1000;
  
  var start_time = run_start.getTime();
  
  // if run is at or after 7:30AM create reminder 2 hours before, 6AM at the earliest.
  if (snack != null) {
    var snack_time = snack.getStartTime().getTime();
    
    if (snack_time + snack_offset_time != start_time || run_start.getHours() < 8) {
      Logger.log("Snack doesn't start on time.  Deleting it.");
      deleteSnackFor(run_cal, run_start); // make sure any rogue events are gone
      snack = null;
    }
  }
  
  // create snack if it doesn't exist now (might have been deleted)
  if (snack == null && run_start.getHours() >= 8) {
    snack = run_cal.createEvent(EVENT_TITLE_SNACK, new Date(start_time - snack_offset_time), new Date(start_time));
    Logger.log("Created Snack event");
  }
  
  // if it's a weekday, stretch should be created at 8PM to 10PM
  // else, set stretch for the 2 hours after the scheduled run
  var stretch_start_date;
  
  // weekdays are 1-5
  var dow = run_start.getDay();
  if (dow >= 1 && dow <= 5) {
    // weekday
    stretch_start_date = run_start;
    // Same day, set time to 8PM
    stretch_start_date.setHours(8+12);
    stretch_start_date.setMinutes(0);
    stretch_start_date.setSeconds(0);
  } else {
    // weekend
    stretch_start_date = run_end;
  }
  
  // delete stretch if it isn't at the right time
  if (stretch != null) {
    var stretch_time = stretch.getStartTime().getTime();
    
    if (stretch_time != stretch_start_date.getTime()) {
      Logger.log("Stretch doesn't start on time.  Deleting it.");
      deleteStretchFor(run_cal, run_start); // make sure any rogue events are gone
      stretch = null;
    }
  }
  
  // create stretch if it doesn't exist now (might have been deleted)
  if (stretch == null) {
    stretch = run_cal.createEvent(EVENT_TITLE_STRETCH, stretch_start_date, new Date(stretch_start_date.getTime() + 2*60*60*1000));
    Logger.log("Created Stretch event");
  }
}

/**
 * Params:
 * event - Event representing the event
 */
function setEventNorms(event) {
  if (event != null) {
    // ensure event reminder is setup correctly
    // we should see this remind at 7PM the day before.
    // popup is created with minutes before event.  Take hours * 60 + 5 * 60 (to go back from midnight to 7PM) + minutes
    var expect = (event.getStartTime().getHours() + 5) * 60 + event.getStartTime().getMinutes();

    // array of number of minutes before event popup reminder will trigger
    var r = event.getPopupReminders();
    if (r.length != 2 || (r[0] != expect && r[1] != expect)) {
      event.removeAllReminders();
      event.addPopupReminder(60); // also 60 min before..
      event.addPopupReminder(expect);
      Logger.log("reminders have been reset");
    }
  }
}

