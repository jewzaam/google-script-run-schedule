var DATA_CLOTHING = null;

function get_relative_temperature_str(
  temp_f,
  wind_mph,
  is_rain,
  is_snow,
  is_cloudy,
  is_thunderstorm,
  is_chance,
  is_light,
  is_heavy,
  time_of_day_string
) {
  var weather = [{}];
  weather[0].temp_f = temp_f;
  weather[0].wind_mph = wind_mph;
  weather[0].conditions = {};
  weather[0].conditions.is_rain = is_rain;
  weather[0].conditions.is_snow = is_snow;
  weather[0].conditions.is_cloudy = is_cloudy;
  weather[0].conditions.is_thunderstorm = is_thunderstorm
  weather[0].conditions.is_chance = is_chance;
  weather[0].conditions.is_light = is_light;
  weather[0].conditions.is_heavy = is_heavy;
  weather[0].time_of_day_string = time_of_day_string;
  return get_relative_temperature(weather);
}

function get_relative_temperature(weather) {
  // pick first element only.  Have to pick something
  var w = weather[0];
  var relative_temp_f = w.temp_f;
  var is_wet = false;
  
  // precipitation doesn't depend on time of day
  if (w.conditions.is_rain) {
    is_wet = true;
    if (w.conditions.is_light) {
      relative_temp_f -= 4;
    } else if (w.conditions.is_heavy) {
      relative_temp_f -= 10;
    } else {
      relative_temp_f -= 7;
    }
  } else if (w.conditions.is_thunderstorm) {
    is_wet = true;
    relative_temp_f -= 10; // same as heavy rain
  } else if (w.conditions.is_snow) {
    is_wet = true;
    relative_temp_f -= 3;
  }
  
  // wind doesn't depend on time of day
  if (w.wind_mph > LIGHT_WIND_MAX) {
    // heavy wind
    relative_temp_f -= 9;
  } else if (w.wind_mph > 0 && w.wind_mph <= LIGHT_WIND_MAX) {
    relative_temp_f -= 5;
  }
  
  // time of day only matters if it isn't wet
  if (!is_wet) {
    switch (w.time_of_day_string) {
      case "day":
        if (w.conditions.is_cloudy) {
          if (w.conditions.is_light) {
            relative_temp_f += 5;
          } else {
            relative_temp_f += 2;
          }
        } else {
          // clear
          relative_temp_f += 10;
        }
        break;
      case "dawn":
      case "dusk":
        if (w.conditions.is_cloudy && w.conditions.is_light) {
          relative_temp_f += 2;
          // note, no adjustment if it's overcast
        } else {
          // clear
          relative_temp_f += 5;
        }
        break;
      default: // night
        // noop, doesn't matter what cloud cover is at night
    }
  }
  
  return relative_temp_f;
}

function get_clothing_for(weather) {
  debug("get_clothing_for");
  var clothing = {};
  
  var relative_temp_f = get_relative_temperature(weather);

  // read clothing rules
  if (DATA_CLOTHING == null) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME_CLOTHING);
    DATA_CLOTHING = sheet.getRange(2, 1, 100, 5).getValues();
  }
  
  for (var i = 0; i < DATA_CLOTHING.length; i++) {
    var where = DATA_CLOTHING[i][0];
    var what = DATA_CLOTHING[i][1];
    var min_temp_f = DATA_CLOTHING[i][2];
    var max_temp_f = DATA_CLOTHING[i][3];
    var condition = DATA_CLOTHING[i][4];
    
    debug("where: " + where);
    debug("what: " + what);
    debug("min_temp_f: " + min_temp_f);
    debug("max_temp_f: " + max_temp_f);
    debug("condition: " + condition);
    
    if (where == null || where == "") {
      break;
    }
    
    if ((min_temp_f == null || min_temp_f == "" || min_temp_f <= relative_temp_f) &&
        (max_temp_f == null || max_temp_f == "" || relative_temp_f < max_temp_f) &&
        (condition == null || condition == "" || weather[0][condition])) {
        
        var x = clothing[where];
        
        // have a match, add the clothing
        if (x == null || x == "") {
          x = [];
        }
        x[x.length] = what;
        
        clothing[where] = x;
    }
  }
  
  debug("clothing: " + JSON.stringify(clothing));
  
  return clothing;
}

function get_clothing_title(clothing) {
  return "";
}

function get_clothing_description(clothing) {
  var description = '';
  var c;
  
  // head
  c = clothing["head"];
  
  if (c != null && c != "") {
    description += "<strong>Head:</strong><br>";
    
    for (var i = 0; i < c.length; i++) {
      description += ("* " + c[i] + "<br>");
    }
  }
  
  // torso
  c = clothing["torso"];
  
  if (c != null && c != "") {
    description += "<br><strong>Torso:</strong><br>";
    
    for (var i = 0; i < c.length; i++) {
      description += ("* " + c[i] + "<br>");
    }
  }
  
  // hands
  c = clothing["hands"];
  
  if (c != null && c != "") {
    description += "<br><strong>Hands:</strong><br>";
    
    for (var i = 0; i < c.length; i++) {
      description += ("* " + c[i] + "<br>");
    }
  }
  
  // legs
  c = clothing["legs"];
  
  if (c != null && c != "") {
    description += "<br><strong>Legs:</strong><br>";
    
    for (var i = 0; i < c.length; i++) {
      description += ("* " + c[i] + "<br>");
    }
  }
  
  debug("get_clothing_description = " + description);
  
  return description;
}
