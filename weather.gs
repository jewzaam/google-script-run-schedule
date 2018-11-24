function get_weather_forecast(event) {
  debug("get_weather_forecast("+event.getId()+")");

  var forecasts = get_wunderground_forecast(event);
  debug("XXX: " + JSON.stringify(forecasts));
  var weather_data = [];
  
  var hour = new Date(event.getStartTime());
  hour.setMinutes(0);
  hour.setSeconds(0);
  var epoch = hour.getTime() / 1000;
  
  var hour_count = Math.floor((event.getEndTime().getTime() - event.getStartTime().getTime()) / 1000 / 60 / 60);

  debug("epoch: " + epoch);
  debug("hour_count: " + hour_count);

  // find first event in forecasts that matches hour (epoch)
  for (var j = 0; j < forecasts.hourly_forecast.length; j++) {
    var forecast = forecasts.hourly_forecast[j];
    debug("forecasts["+j+"]: "+JSON.stringify(forecast));
    
    if (forecast.FCTTIME.epoch == epoch) {
      // found first forecast, from here, use each of the following up to and including hour_count
      debug("forecast found, j="+j);
      
      // get the time of day, which doesn't change
      // TODO support for event spanning days?
      var time_of_day = get_time_of_day(event);
      
      for (var i = 0; i < hour_count; i++) {
        forecast = forecasts.hourly_forecast[j + i];
      
        debug("FORECAST: " + JSON.stringify(forecast));
        
        var conditions = get_conditions_for(forecast.condition);
        
        var emoji = "";
        
        // prefix modifiers
        emoji += get_emoji("weather", time_of_day.string);

        if (conditions.is_chance) {
          emoji += get_emoji("weather", "chance_of")
        }
        
        // condition
        if (conditions.is_thunderstorm) {
          emoji += get_emoji("weather", "thunderstorm")
        } else if (conditions.is_snow) {
          emoji += get_emoji("weather", "snow");
        } else if (conditions.is_cloudy) {
          var key = "";
          if (conditions.is_light) {
            key += "partly ";
          }
          key += "cloudy";
          emoji += get_emoji("weather", key);
        } else if (conditions.is_rain) {
          var key = "";
          if (conditions.is_light) {
            key += "light ";
          } else if (conditions.is_heavy) {
            key += "heavy ";
          }
          key += "rain";
          emoji += get_emoji("weather", key);
        } else {
          emoji += get_emoji("weather", "clear");
        }
        
        // postfix modifiers
        if (forecast.dewpoint.english >= HUMID_DEWPOINT_MIN) {
          emoji += get_emoji("weather", "humid");
        }
        if (forecast.wspd.english > LIGHT_WIND_MAX) {
          emoji += get_emoji("weather", "windy");
        }
        
        weather_data[i] = {
          temp_f: forecast.temp.english,
          dewpoint_f: forecast.dewpoint.english,
          wind_mph: forecast.wspd.english,
          chance_of_rain: forecast.pop, // https://www.weather.gov/ffc/pop
          condition_raw: forecast.condition,
          conditions: conditions,
          emoji: emoji,
          time_of_day: time_of_day,
          
          // data needed for forecast link, where and when
          city: get_city_for(event),
          state: get_state_for(event),
          year: forecast.FCTTIME.year,
          month: forecast.FCTTIME.mon,
          day: forecast.FCTTIME.mday,
          
          // parsable for description
          time_of_day_string: time_of_day.string,
          time_of_day_sunrise: (time_of_day.sunrise.hour + ":" + time_of_day.sunrise.minute),
          time_of_day_sunset: (time_of_day.sunset.hour + ":" + time_of_day.sunset.minute),
        };
        
        debug("WEATHER: " +JSON.stringify(weather_data[i]));
      }
      
      // don't need to process outer loop, we are done
      break;
    }
  }
  
  return weather_data;
}

function get_conditions_for(wunderground_condition) {
  debug("get_conditions_for("+wunderground_condition+")");

  var output = {
    is_rain: false,
    is_snow: false,
    is_cloudy: false,
    is_thunderstorm: false,
    is_chance: false,
    is_light: false,
    is_heavy: false
  };

  var condition_uc = wunderground_condition.toUpperCase();

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


/**
 * return: {string: (one of: night, dawn, day, dusk), sunrise: {hour: int, minute: int}, sunset: {hour: int, minute: int}}
 */
function get_time_of_day(event) {
  debug("get_time_of_day("+event.getId()+")");

  var city = get_city_for(event);
  var state = get_state_for(event);
  
  var astronomy = get_wunderground_astronomy(city, state);
  
  // make sure all dates are on the same day else it's crazy.
  var sunrise = new Date(event.getStartTime().getTime());
  sunrise.setHours(astronomy.sun_phase.sunrise.hour);
  sunrise.setMinutes(astronomy.sun_phase.sunrise.minute);
  var sunset = new Date(event.getStartTime().getTime());
  sunset.setHours(astronomy.sun_phase.sunset.hour);
  sunset.setMinutes(astronomy.sun_phase.sunset.minute);
  var dusk = new Date(sunset.getTime() + 1000 * 60 * SUNSET_LENGTH_MIN); // actually when dusk ends.
  var dawn = new Date(sunrise.getTime() - 1000 * 60 * SUNRISE_LENGTH_MIN);
  
  debug("dawn: " + dawn);
  debug("sunrise: " + sunrise);
  debug("sunset: " + sunset);
  debug("dusk: " + dusk);
  
  dawn = dawn.valueOf();
  sunrise = sunrise.valueOf();
  sunset = sunset.valueOf();
  dusk = dusk.valueOf();
  var event_start = event.getStartTime().valueOf();

  // order of checks matters
  var time_of_day = "unknown"; // just to have a default

  if (event_start < dawn) {
    time_of_day = "night";
  } else if (dawn <= event_start && event_start < sunrise) {
    time_of_day = "dawn";
  } else if (sunrise <= event_start && event_start < sunset) {
    time_of_day = "day";
  } else if (sunset <= event_start && event_start < dusk) {
    time_of_day = "dusk";
  } else if (dusk < event_start) {
    time_of_day = "night";
  }
  
  debug("calculated time of day: " + time_of_day);
  
  return {
    "string": time_of_day,
    "sunrise": astronomy.sun_phase.sunrise,
    "sunset": astronomy.sun_phase.sunset,
  }
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
  var description = '<a href="https://www.wunderground.com/hourly/us/'+weather[0].state+'/'+weather[0].city+'/date/'+weather[0].year+"-"+weather[0].month+"-"+weather[0].day+'">Hourly Forecast</a><br>';
  
  description += create_description_data(weather, "temp_f", "F", true);
  description += create_description_data(weather, "dewpoint_f", "F", true);
  description += create_description_data(weather, "condition_raw", null, true); // this may not work
  description += create_description_data(weather, "chance_of_rain", "%", true);
  description += create_description_data(weather, "wind_mph", "mph", true);
  description += create_description_data(weather, "time_of_day_string", null, false);
  description += create_description_data(weather, "time_of_day_sunrise", null, false);
  description += create_description_data(weather, "time_of_day_sunset", null, false);

  description += '<br><a href="http://files.jewzaam.org/legend.html">Legend</a>'
  
  debug("get_weather_description = " + description);
  
  return description;
}
