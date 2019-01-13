function get_conditions_for(weather) {
  debug("get_conditions_for("+weather+")");

  var output = {
    is_rain: false,
    is_snow: false,
    is_cloudy: false,
    is_thunderstorm: false,
    is_chance: false,
    is_light: false,
    is_heavy: false
  };

  var condition_uc = weather.toUpperCase();

  output.is_chance = (condition_uc.indexOf("CHANCE") > -1);
  output.is_light = (condition_uc.indexOf("LIGHT") > -1 || condition_uc.indexOf("PARTIAL") > -1 || condition_uc.indexOf("PATCHES") > -1 || condition_uc.indexOf("SHALLOW") > -1);
  output.is_heavy = (condition_uc.indexOf("HEAVY") > -1);
  
  // order matters.  bad conditions first
  if (condition_uc.indexOf("THUNDERSTORM") > -1) {
    output.is_thunderstorm = true;
  } else if (condition_uc.indexOf("SNOW") > -1 || condition_uc.indexOf("HAIL") > -1 || condition_uc.indexOf("ICE") > -1) {
    output.is_snow = true;
  } else if (condition_uc.indexOf("DRIZZLE") > -1) {
    output.is_rain = true;
    output.is_light = true;
    output.is_heavy = false;
  } else if (condition_uc.indexOf("SQUALLS") > -1) {
    output.is_rain = true;
    output.is_light = false;
    output.is_heavy = true;
  } else if (condition_uc.indexOf("RAIN") > -1) {
    output.is_rain = true;
  } else if (condition_uc.indexOf("FOG") > -1 || condition_uc.indexOf("HAZE") > -1 || condition_uc.indexOf("MIST") > -1) {
    output.is_cloudy = true;
  } else if (condition_uc.indexOf("OVERCAST") > -1) {
    output.is_cloudy = true;
  } else if (condition_uc.indexOf("CLOUDY") > -1 || condition_uc.indexOf("CLOUDS") > -1) {
    output.is_cloudy = true;
    output.is_light = true;
  }

  return output;
}

function get_weather_title(weather) {
  // build title
  var title = weather[0].emoji;
  
  for (var i = 1; i < weather.length; i++) {
    if (weather[i-1].emoji != weather[i].emoji) {
      title += (get_emoji("misc", "arrow") + weather[i].emoji);
    }
  }
  
  return title;
}

function get_weather_description(weather) {
  var description = '';//'<a href="https://www.wunderground.com/hourly/us/'+weather[0].state+'/'+weather[0].city.replace(" ","-").replace("+","-")+'/date/'+weather[0].year+"-"+weather[0].month+"-"+weather[0].day+'">Hourly Forecast</a><br>';
  
  description += create_description_data(weather, "temp_f", "F", true);
  description += create_description_data(weather, "relative_temp_f", "F", true);
  //description += create_description_data(weather, "dewpoint_f", "F", true);
  description += create_description_data(weather, "condition_raw", null, true); // this may not work
  //description += create_description_data(weather, "chance_of_rain", "%", true);
  description += create_description_data(weather, "wind_mph", "mph", true);
  description += create_description_data(weather, "time_of_day", null, true);
  description += create_description_data(weather, "time_of_day_sunrise", null, false);
  description += create_description_data(weather, "time_of_day_sunset", null, false);

  description += '<br><a href="http://files.jewzaam.org/legend.html">Legend</a>'
  
  debug("get_weather_description = " + description);
  
  return description;
}

function get_relative_temperature(weather) {
  debug("get_relative_temperature: " + JSON.stringify(weather));
  var w = weather;
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
  
  // wind doesn't depend on time of day, just assume each mph drops temp by 1F with a max of 9F
  relative_temp_f -= Math.min(9, w.wind_mph);
  
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
