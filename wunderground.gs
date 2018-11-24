function get_city_for(event) {
  return CACHE_CITY[event.getId()];
}

function set_city_for(event, city) {
  CACHE_CITY[event.getId()] = city;
}

function get_state_for(event) {
  return CACHE_STATE[event.getId()];
}

function set_state_for(event, state) {
  CACHE_STATE[event.getId()] = state;
}

function get_wunderground_astronomy(city, state) {
  return get_wunderground("astronomy", city, state);
}

function get_wunderground_forecast(event) {
  // returns object: [{temp_f, condition_raw, condition_normalized, wind_mph, time_of_day, emoji, dewpoint_f]]
  var hours = event.getEndTime().getHours() - event.getStartTime().getHours() + Math.ceil((event.getEndTime().getMinutes() - event.getStartTime().getMinutes())/60);
  debug("hours: " + hours);
  
  // location might be more than just city and state.  try tuples until something works.
  var city = get_city_for(event);
  var state = get_state_for(event);
  
  debug("city = " + city);
  debug("state = " + state);
  
  if (city != null && state != null) {
    debug("get_wunderground_forecast("+city+", "+state+"): using cached city and state");
    return get_wunderground("hourly10day", city, state);
  }
  
  // city and state are not cached for the event.
  // find the values that work, cache it, and return the forecast
  var forecast;
  
  try {
    var location = event.getLocation();
    
    if (location == null || location == "") {
      location = DEFAULT_CITY + ", " + DEFAULT_STATE;
      event.setLocation(location);
    }
    
    debug("location = " + location);
    var s = location.split(",");
    
    if (s.length >= 2) {
      for (var x = s.length - 2; x >= 0; x--) {
        var city_orig = s[x].trim();
        var state_orig = s[x+1].trim();
        
        city = city_orig;
        state = state_orig;
        debug("1 city:"+city+", state:"+state);

        // always split "state" by space
        if (state.indexOf(" ") > 0) {
          state = state.split(" ")[0];
        }

        debug("2 city:"+city+", state:"+state);
        // patterns to try for city, in this order:
        // 1) replace " " with "-" and dedup "-" (i.e. " - " becomes "-")
        // 2) split on "-", keeping last element
        // 3) as-is
        // always trim
        
        if (forecast == null && city.indexOf(" ") > 0) {
          // replace " " with "-"
          try {
            city = city.replace(" ", "-");
            // replace -- by - a few times
            city = city.replace("--", "-");
            city = city.replace("--", "-");
            city = city.replace("--", "-");
            // and finally trim
            city = city.trim();
            debug("3 city:"+city+", state:"+state);
            forecast = get_wunderground_hourly10day(city, state);
          } catch (Error) {
            forecast = null;
          }
        }

        if (forecast == null && city.indexOf("-") > 0) {
          // last element, "-" delimiter
          try {
            var x = city.split("-");
            city = x[x.length - 1].trim();
            debug("4 city:"+city+", state:"+state);
            forecast = get_wunderground_hourly10day(city, state);
          } catch (Error) {
            forecast = null;
          }
        }
        
        if (forecast == null) {
          try {
            // as-is
            city = city_orig;
            state = state_orig;
            debug("5 city:"+city+", state:"+state);
            forecast = get_wunderground_hourly10day(city, state);
          } catch (Error) {
            forecast = null;
          }
        }

        if (forecast != null) {
          break;
        }
      }
    }
  } catch (Error) {
    debug("ERROR: get_wunderground_forecast");
  }
  
  // cache the city and state
  set_city_for(event, city);
  set_state_for(event, state);
  
  return forecast;
}

function get_wunderground_hourly10day(city, state) {
  var forecast = get_wunderground("hourly10day", city, state);
  
  if (forecast != null && forecast.hourly_forecast == null) {
    debug("get_wunderground_hourly10day response missing 'hourly_forecast'");
    forecast = null;
  }
  
  return forecast;
}

function get_wunderground(api_name, city, state) {
  debug("get_wunderground("+api_name+", "+city+", "+state+")");

  // if both are two chars, skip.  assumes it's a state and iso2 code
  if (city.length == 2 && state.length == 2) {
    return undefined;
  }

  var url = "http://api.wunderground.com/api/" + KEY_WEATHER_UNDERGROUND + "/" + api_name + "/q/" + state + "/" + city +".json";
  
  var response = get_url(url);
  var data = JSON.parse(response);
  
  if (data.response.error != null || data.error != null) {
    // if there's an error in the response, return nothing
    return undefined;
  }
  
  return data;
}

function _test() {
  var response = get_wunderground_hourly10day("Cary stuff and things - Cary", "NC");
  if (response == null) {
    debug("I'm null.. ok");
  }
}
