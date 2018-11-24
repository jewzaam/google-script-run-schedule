function test() {
  process_events(3);
}

function process_today() {
  process_events(0);
}

function process_tomorrow() {
  process_events(1);
}

function process_future() {
  // day after tomorrow, up to 10 days
  for (var i = 1; i < 10; i++) {
    process_events(i);
  }
}

function was_accepted(event) {
  return (event.getGuestList().length == 0 || event.getGuestByEmail(Session.getActiveUser().getEmail()).getGuestStatus() != event.getMyStatus().NO)
}

function can_process(event) {
  // don't update the event if it's in the past.  
  // NOTE weather forecasts are hourly and do not provide the current hour.
  //      therfore, if event starts within the current hour, there will be no forecast available.
  //      this check must exclude minutes and seconds for the target start date
  var x = event.getStartTime();
  x.setMinutes(0);
  x.setSeconds(0);
  var output = (new Date().getTime() <= x.getTime());
  debug("can_process(" + event.getId() + ") = " + output);
  return output;
}

function process_events(days_from_today) {
  log_start("process_events("+days_from_today+")");

  var target = new Date();
  target.setDate(target.getDate() + days_from_today);
  
  debug("target = " + target);
  debug("timezone = " + Session.getScriptTimeZone());
  
  var min_run_start, max_run_end;
  
  var main_cal = CalendarApp.getCalendarsByName(CALENDAR_NAME_MAIN)[0];
  var run_cal = CalendarApp.getCalendarsByName(CALENDAR_NAME_RUN)[0];
  
  var found_run = false;
  
  // find any outdoor events in calendar
  var events = find_event_for(main_cal, target);
  
  for (var j = 0; j < events.length; j++) {
    var e = events[j];
    var is_run = false;
    
    debug("event.getId() = " + e.getId());
    
    if (e.getColor() == OUTSIDE_EVENT_COLOR) {
      var t = e.getTitle();
      Logger.log("Event: " + target.getDay() + " " + t);
      
      // for any event with at least one guest check if I accepted too
      var tUC = t.toUpperCase();
      if (tUC.indexOf(EVENT_TITLE_RUN_UC) > -1 && was_accepted(e)) {
        found_run = true;
        
        if (run_cal == null) {
          // can't process a run if we don't have a run calendar
          // NOTE do not fail before this in case there are no runs to process
          throw new Error("No calendar named '" + CALENDAR_NAME_RUN + "' found. Set with config option 'CALENDAR_NAME_RUN'.");
        }
        
        Logger.log("Found a '" + EVENT_TITLE_RUN + "': " + t);
      }
      
      // skip this event if we can't process it
      if (!can_process(e)) {
        continue;
      }
      
      // it's an outdoor event! update weather on the event and get the weather data
      var weather = get_weather_forecast(e);
      debug("TEMP DEBUG: " + JSON.stringify(weather));
      var w_title = get_weather_title(weather);
      var w_description = get_weather_description(weather);
      
      update_event(e, w_title, w_description);
      
      if (found_run && was_accepted(e)) {
        // it's also a run!
        
        // clear reminders for myself on the main event (they'll be set on clothing event)
        e.removeAllReminders();
        
        var clothing = get_clothing_for(weather);
        // note we don't save clothing on the run event because clothing is personal
        // and outdoor events (a superset of run events) can have others invited
        var c_title = get_clothing_title(clothing);
        var c_desc = get_clothing_description(clothing);
        
        var ec = find_related_event_for_on(e, run_cal);
        
        // delete extras
        for (var r = 1; r < ec.length; r++) {
          ec[r].deleteEvent();
        }
        
        var clothing_event;
        
        if (ec.length > 0) {
          clothing_event = ec[0];
        } else {
          clothing_event = run_cal.createEvent(e.getTitle(), e.getStartTime(), e.getEndTime());
        }
        
        // update event title, start, end, desc, and location
        clothing_event.setTitle(e.getTitle());
        c_desc = e.getDescription() + "\n" + DELIMITER_EVENT_DESCRIPTION + "\n" + c_desc + 
          "\n" + DELIMITER_EVENT_DESCRIPTION + "\n" + "ref_id=" + e.getId();
        clothing_event.setDescription(c_desc);
        clothing_event.setLocation(e.getLocation());
        clothing_event.setTime(e.getStartTime(), e.getEndTime());
        
        save_run_reminders_for(clothing_event);
      }
    }
  }
  
  // cleanup any clothing events that have no reference anymore.
  delete_unrelated_events_on(main_cal, run_cal, target);
  
  log_stop("process_events("+days_from_today+")");
}


function update_event(event, title, description) {
  // build and set title
  var t = (event.getTitle().split(DELIMITER_EMOJI)[0].trim() + DELIMITER_EMOJI + title);

  event.setTitle(t);

  // build and set description
  var d = event.getDescription().split(DELIMITER_EVENT_DESCRIPTION)[0].trim();
  d += ("\n" + DELIMITER_EVENT_DESCRIPTION + "\n");
  d += description;
  
  event.setDescription(d);
}


function create_description_data(data, key, uom, show_transitions) {
  var label = get_emoji("legend", key);

  var output = "<strong>" + label + "</strong>: ";
  var next = "";
  var last = "";
  
  for (var i = 0; i < data.length; i++) {
    next = data[i][key];
    
    if (uom != null) {
      next += (" " + uom);
    }
    if (last == "") {
      // only add the first iteration, when last is not set
      output += next;
      if (!show_transitions) {
        last = next;
        // bail early
        break;
      }
    } else if (show_transitions) {
      output += (" " + get_emoji("misc", "arrow") + " " + next);
    }
    
    last = next;
    next = "";
  }
  
  output += "<br>";
  
  return output;
}

function save_run_reminders_for(event) {
  debug("save_run_reminders_for("+event.getId()+")");
  if (event != null) {
    // ensure event reminder is setup correctly
    // we should see this remind at 7PM the day before.
    // popup is created with minutes before event.  Take hours * 60 + 5 * 60 (to go back from midnight to 7PM) + minutes
    var expect = (event.getStartTime().getHours()) * 60 - event.getStartTime().getMinutes();
    
    debug("expect: " + new Date(event.getStartTime()));
    debug("expect: (" + event.getStartTime().getHours() + " +  5) * 60 - " + event.getStartTime().getMinutes() + " = " + expect);

    // array of number of minutes before event popup reminder will trigger
    var r = event.getPopupReminders();
    if (r.length != 2 || (r[0] != expect && r[1] != expect)) {
      event.removeAllReminders();
      event.addPopupReminder(5);
      event.addPopupReminder(60);
      event.addPopupReminder(expect);
      Logger.log("reminders have been reset");
    }
  }
}



function delete_unrelated_events_on(main_cal, run_cal, date) {
  debug("delete_unrelated_events_on(" + main_cal.getName() + ", " + run_cal.getName() + ")");
  
  var events = find_event_for(run_cal, date);
  
  for (var i = 0; i < events.length; i++) {
    var event = events[i];
    
    var desc = event.getDescription();

    // ref_id is in the last chunk of description
    var x = desc.split(DELIMITER_EVENT_DESCRIPTION);
    var ref_id_str = x[x.length-1];
    var ref_id = ref_id_str.split("=")[1];
    
    // now find event by ref_id (event's ID)
    debug("find ref_id: " + ref_id);
    
    // REF: https://stackoverflow.com/questions/43195549/retrieve-deleted-calendar-events
    var ref_events = Calendar.Events.list(
      main_cal.getId(),
      {
        iCalUID: ref_id,
        fields: "items(id,status,summary)",
        timeMin: ISODateString(event.getStartTime()),
        timeMax: ISODateString(event.getEndTime()),
      }
    );
    
    debug("ref_events: " + JSON.stringify(ref_events));
    
    if (ref_events == null || ref_events.items == null || ref_events.items.length == 0) {
      debug("no reference event found for ref_id '" + ref_id + "'");
      event.deleteEvent();
    }
  }
}

function find_related_event_for_on(event, calendar) {
  // search on calendar for an event that is related to the given event
  debug("find_related_event_for_on(" + event.getId() + ", " + calendar.getName() + ")");
  
  var search_string = '"ref_id=' + event.getId() + '"';
  
  var from = event.getStartTime();
  var to = event.getEndTime();
  
  from.setHours(from.getHours()-1);
  to.setHours(to.getHours()+1);
  
  var events = calendar.getEvents(from, to,
                                  {
                                    search: search_string
                                  }
                                 );
  return events;
}

function find_event_for(calendar, date, title) {
  debug("find_event_for(" + calendar.getName() + ", " + date + ", " + title + ")");
  
  var events = calendar.getEvents(new Date(date.getTime() - 1 * 60 * 60 * 1000), 
                                  new Date(date.getTime() + 24 * 60 * 60 * 1000));
  var output = [];
  
  if (title != null && title != "") {
    var search = title.toUpperCase();
    
    for (var j = 0; j < events.length; j++) {
      var e = events[j];
      
      // find event by name, ignore case
      var tUC = e.getTitle().toUpperCase();
      if (tUC == search) {
        // found a match, add to output
        output[output.length] = e;
      }
    }
  } else {
    output = events;
  }
  
  return output;
}
