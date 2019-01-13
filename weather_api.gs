function weather_api_get_sunrise_sunset(location) {
  var coordinates = get_coordinates(location); // array
  
  // if no coordinates found, use defaults
  if (coordinates == null) {
    debug("Using default location, no coordinates found with location '" + location + "'.");
    coordinates = get_coordinates(DEFAULT_CITY + ", " + DEFAULT_STATE);
  }
  
  var data = JSON.parse(get_url("https://api.sunrise-sunset.org/json?lat=" + coordinates[0] + "&lng=" + coordinates[1] + "&formatted=0"));
  
  var sunrise = new Date(data.results.sunrise);
  var sunset = new Date(data.results.sunset);
  
  return {
    "sunrise": {
      "string": (sunrise.getHours() + ":" + Utilities.formatString("%02d", sunrise.getMinutes())),
      "epoch": sunrise.getTime()
    },
    "sunset": {
      "string": (sunset.getHours() + ":" + Utilities.formatString("%02d", sunset.getMinutes())),
      "epoch": sunset.getTime()
    }
  };
}

/**
 * return: {data: [(one of: night, dawn, day, dusk)], sunrise: string, sunset: string}
 */
function weather_api_get_time_of_day(event) {
  return _weather_api_get_time_of_day(event.getStartTime(), event.getEndTime(), event.getLocation());
}

function _weather_api_get_time_of_day(startTime, endTime, location) {
  var time_of_day = [];
  var astronomy;
  
  debug("LOCATION: " + location);
  
  try {
    astronomy = weather_api_get_sunrise_sunset(location);

    // make sure all dates are on the same day else it's crazy.
    var sunrise = new Date(astronomy.sunrise.epoch);
    var sunset = new Date(astronomy.sunset.epoch);
    var dusk = new Date(sunset.getTime() + 1000 * 60 * SUNSET_LENGTH_MIN); // actually when dusk ends.
    var dawn = new Date(sunrise.getTime() - 1000 * 60 * SUNRISE_LENGTH_MIN);
    
    debug("dawn: " + dawn);
    debug("sunrise: " + sunrise);
    debug("sunset: " + sunset);
    debug("dusk: " + dusk);

    var start = new Date(startTime.getTime());
    // move start to the same day as sunrise so epoch comparison works
    start.setYear(sunrise.getYear());
    start.setMonth(sunrise.getMonth());
    start.setDate(sunrise.getDate());

    // switch to epoch (after updating start's day)
    dawn = dawn.valueOf();
    sunrise = sunrise.valueOf();
    sunset = sunset.valueOf();
    dusk = dusk.valueOf();

    debug("dawn: " + dawn);
    debug("sunrise: " + sunrise);
    debug("sunset: " + sunset);
    debug("dusk: " + dusk);

    while (start.getHours() <= endTime.getHours()) {
      debug("start: " + start);
      
      var event_start = start.valueOf();
      
      debug("event_start: " + event_start);
      
      // order of checks matters
      
      if (event_start < dawn) {
        time_of_day.push("night");
      } else if (dawn <= event_start && event_start < sunrise) {
        time_of_day.push("dawn");
      } else if (sunrise <= event_start && event_start < sunset) {
        time_of_day.push("day");
      } else if (sunset <= event_start && event_start < dusk) {
        time_of_day.push("dusk");
      } else if (dusk < event_start) {
        time_of_day.push("night");
      }
      
      // move to next hour
      start.setHours(start.getHours() + 1);
    }
    
    return {
      "data": time_of_day,
      "sunrise": astronomy.sunrise.string,
      "sunset": astronomy.sunset.string,
    }

  } catch (e) {
    debug("Failed to get astronomy stuff! Defaulting.. :(");
    debug("ERROR: " + JSON.stringify(e));
    time_of_day = "day";
    return {
      "data": [],
      "sunrise": "unknown",
      "sunset": "unknown"
    };
  }
}

function weather_api_get_forecast(event) {
  debug("weather_api_get_forecast("+event.getId()+")");

  var weather_data = [];
  
  var hour = new Date(event.getStartTime());
  hour.setMinutes(0);
  hour.setSeconds(0);
  
  var startTimeStr = Utilities.formatDate(hour, 
    CalendarApp.getDefaultCalendar().getTimeZone(),
    'yyyy-MM-dd\'T\'HH:mm:ssXXX'
  );
  
  var hour_count = Math.max(1, Math.floor((event.getEndTime().getTime() - event.getStartTime().getTime()) / 1000 / 60 / 60));

  debug("startTimeStr: " + startTimeStr);
  debug("hour_count: " + hour_count);

  var location = event.getLocation();
  var coordinates = get_coordinates(location);
  
  debug("location: " + location);
  
  // get metadata needed to get forecast
  var points = JSON.parse(get_url("https://api.weather.gov/points/" + coordinates[0] + "," + coordinates[1]));
  
  // get forecast
  var forecasts = JSON.parse(get_url("https://api.weather.gov/gridpoints/" + points.properties.cwa + "/" + points.properties.gridX + "," + points.properties.gridY + "/forecast/hourly?units=us"));

  // find first event in forecasts that matches startDateStr
  for (var j = 0; j < forecasts.properties.periods.length; j++) {
    var forecast = forecasts.properties.periods[j];
    
    if (forecast.startTime == startTimeStr) {
      // found first forecast, from here, use each of the following up to and including hour_count
      
      // get the time of day, which doesn't change
      // NOTE not worrying about spanning days at this time
      var time_of_day = weather_api_get_time_of_day(event);
      
      for (var i = 0; i < hour_count; i++) {
        forecast = forecasts.properties.periods[j + i];
      
        var conditions = get_conditions_for(forecast.shortForecast);
        
        var emoji = "";
        
        // prefix modifiers
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
        // TODO fix this once we have dew point back
        /*
        if (forecast.dewpoint.english >= HUMID_DEWPOINT_MIN) {
          emoji += get_emoji("weather", "humid");
        }
        */
        
        var windSpeed = forecast.windSpeed.split(" ")[0];
        
        if (windSpeed > LIGHT_WIND_MAX) {
          emoji += get_emoji("weather", "windy");
        }
        
        // TODO need to use non-forecast 
        
        weather_data[i] = {
          temp_f: forecast.temperature,
          //dewpoint_f: forecast.???
          wind_mph: windSpeed,
          chance_of_rain: forecast.pop, // https://www.weather.gov/ffc/pop
          condition_raw: forecast.shortForecast,
          conditions: conditions,
          emoji: emoji,
          time_of_day: time_of_day,
          
          // data needed for forecast link, where and when
          city: get_city_for(event),
          state: get_state_for(event),
          year: event.getStartTime().getYear(),
          month: event.getStartTime().getMonth() + 1,
          day: event.getStartTime().getDate(),
          
          // parsable for description
          time_of_day: time_of_day.data[i],
          time_of_day_sunrise: time_of_day.sunrise,
          time_of_day_sunset: time_of_day.sunset,
        };
        
        // calculate relative temp and set on weather
        var relative_temp_f = get_relative_temperature(weather_data[i]);
        weather_data[i].relative_temp_f = relative_temp_f;
        
        debug("WEATHER: " +JSON.stringify(weather_data[i]));
      }
      
      // don't need to process outer loop, we are done
      break;
    }
  }
  
  return weather_data;
}

var SHEET_NAME_LOCATIONS="Locations";
var CACHE_LOCATIONS={};

function get_coordinates(location) {
  var coordinates = CACHE_LOCATIONS[location];
  
  if (coordinates == null) {
    debug("get_coordinates: building cache");
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME_LOCATIONS);
    var data = sheet.getRange(2, 1, 100, 3).getValues();
    for (var i = 0; i < data.length; i++) {
      var loc = data[i][0]; // location (city, state)
      var lat = data[i][1]; // lat
      var long = data[i][2]; // long
      
      if (loc == "") {
        // no more data
        break;
      }
      CACHE_LOCATIONS[loc] = [lat, long];
    }
    
    coordinates = CACHE_LOCATIONS[location];
  }
  
  // if still have nothing, look location contained
  var keys = Object.keys(CACHE_LOCATIONS);
  for (var i = 0; i < keys.length; i++) {
    if (location.indexOf(keys[i]) >= 0) {
      coordinates = CACHE_LOCATIONS[keys[i]];
    }
  }
  
  return coordinates;
}


function TEST_weather_api_get_time_of_day() {
  var startTime;
  var endTime;
  var location = "Fuquay-Varina, NC";
  var time_of_day;
  
  var astronomy = weather_api_get_sunrise_sunset(location);
  
  // end time is always 5 minutes after start
  
  debug("TEST_weather_api_get_time_of_day: night (sunrise - 2 hours)");
  startTime = new Date(astronomy.sunrise.epoch - 2 * 60 * 60 * 1000);
  endTime = new Date(startTime.getTime() + 5 * 60 * 1000);
  debug("startTime: " + startTime);
  debug("endTime: " + endTime);
  time_of_day = _weather_api_get_time_of_day(startTime, endTime, location);
  debug("time_of_day: " + JSON.stringify(time_of_day));
  debug("RESULT: " + (time_of_day.data[0] == "night" ? "PASS" : "FAIL"));

  debug("TEST_weather_api_get_time_of_day: dawn (sunrise - SUNRISE_LENGTH_MIN/2 minutes)");
  startTime = new Date(astronomy.sunrise.epoch - SUNRISE_LENGTH_MIN / 2 * 60 * 1000);
  endTime = new Date(startTime.getTime() + 5 * 60 * 1000);
  debug("startTime: " + startTime);
  debug("endTime: " + endTime);
  time_of_day = _weather_api_get_time_of_day(startTime, endTime, location);
  debug("time_of_day: " + JSON.stringify(time_of_day));
  debug("RESULT: " + (time_of_day.data[0] == "dawn" ? "PASS" : "FAIL"));
  
  debug("TEST_weather_api_get_time_of_day: day (sunrise + 2 hours)");
  startTime = new Date(astronomy.sunrise.epoch + 2 * 60 * 60 * 1000);
  endTime = new Date(startTime.getTime() + 5 * 6 * 10000);
  debug("startTime: " + startTime);
  debug("endTime: " + endTime);
  time_of_day = _weather_api_get_time_of_day(startTime, endTime, location);
  debug("time_of_day: " + JSON.stringify(time_of_day));
  debug("RESULT: " + (time_of_day.data[0] == "day" ? "PASS" : "FAIL"));
  
  debug("TEST_weather_api_get_time_of_day: dusk (sunset + SUNSET_LENGTH_MIN/2 minutes)");
  startTime = new Date(astronomy.sunset.epoch + SUNSET_LENGTH_MIN / 2 * 60 * 1000);
  endTime = new Date(startTime.getTime() + 5 * 60 * 1000);
  debug("startTime: " + startTime);
  debug("endTime: " + endTime);
  time_of_day = _weather_api_get_time_of_day(startTime, endTime, location);
  debug("time_of_day: " + JSON.stringify(time_of_day));
  debug("RESULT: " + (time_of_day.data[0] == "dusk" ? "PASS" : "FAIL"));
  
  debug("TEST_weather_api_get_time_of_day: day (tomorrow) (sunrise = 2 hours)");
  startTime = new Date(astronomy.sunrise.epoch + 26 * 60 * 60 * 1000);
  endTime = new Date(startTime.getTime() + 5 * 60 * 1000);
  debug("startTime: " + startTime);
  debug("endTime: " + endTime);
  time_of_day = _weather_api_get_time_of_day(startTime, endTime, location);
  debug("time_of_day: " + JSON.stringify(time_of_day));
  debug("RESULT: " + (time_of_day.data[0] == "day" ? "PASS" : "FAIL"));
  
  debug("TEST_weather_api_get_time_of_day: dawn->day");
  startTime = new Date(astronomy.sunrise.epoch - SUNRISE_LENGTH_MIN / 2 * 60 * 1000);
  endTime = new Date(startTime.getTime() + 1.5 * 60 * 60 * 1000);
  debug("startTime: " + startTime);
  debug("endTime: " + endTime);
  time_of_day = _weather_api_get_time_of_day(startTime, endTime, location);
  debug("time_of_day: " + JSON.stringify(time_of_day));
  debug("RESULT: " + (time_of_day.data[0] == "dawn" ? "PASS" : "FAIL"));
  debug("RESULT: " + (time_of_day.data[1] == "day" ? "PASS" : "FAIL"));
}
