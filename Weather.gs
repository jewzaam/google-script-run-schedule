/*
NOTE this script works on the assumption that the run is within the next 24 hours.

RFE:  This script doesn't account well for a long run, but I don't do runs more than 2 hours so far.  
Eventually would be good to figure out the worst weather and make some recommendations based on changing conditions.  
Or at least create some structure to view it in a table...
*/

function processWeatherForRunEvent(event, is_run) {
  var location = event.getLocation();
  var title = event.getTitle();
  
  // strip off emoji's
  title = title.split(DELIMITER_EMOJI)[0];
  
  // parse title for distance
  var miles = DEFAULT_MILES;
  try {
    var t = title.split(" ");
    for (var i=0; i < t.length; i++) {
      var x = t[i].toUpperCase();
    
      if (x == "MILES" && i != 0) {
        miles = t[i-1];
      }
    }
  } catch (Error) {
    // meh, will just end up with default
    Logger.log("couldn't get miles");
  }
  
  var city, state;
  
  try {
    var s = location.split(",");
    
    if (s.length == 2) {
      city = s[0].replace(/\s/g, "");
      state = s[1].replace(/\s/g, "");
    } else {
      // shrug, force defaults
      city = "";
      state = "";
    }
    
    // and just in case
    if (city == "" || state == "") {
      city = DEFAULT_CITY;
      state = DEFAULT_STATE;
      event.setLocation(city + ", " + state);
    }
  } catch (Error) {}
  
  debug("city = " + city);
  debug("state = " + state);
  debug("miles = " + miles);
  
  // returns object: [{temp_f, condition_raw, condition_normalized, wind_mph, time_of_day, emoji, dewpoint_f]]
  var hours = event.getEndTime().getHours() - event.getStartTime().getHours() + Math.ceil((event.getEndTime().getMinutes() - event.getStartTime().getMinutes())/60);
  debug("hours: " + hours);
  var weather_data = getWeatherData(event.getStartTime(), hours, city, state);

  // create title: weather then clothing emoji for title
  debug("weather data array: " + weather_data[0]);
  var emoji = weather_data[0].emoji;
  var run_data = {miles: miles};
  var clothing_data = [];

  for (var i = 1; i < weather_data.length; i++) {
    if (weather_data[i-1].emoji != weather_data[i].emoji) {
      emoji += ("➡" + weather_data[i].emoji);
    }
  }

  if (is_run) {
    // get clothing info: [{emoji, description}]
    var clothing_data = getClothingData(weather_data, miles);

    emoji += DELIMITER_EMOJI + clothing_data[0].emoji;
    
    for (var i = 1; i < clothing_data.length; i++) {
      if (clothing_data[i-1].emoji != clothing_data[i].emoji) {
        emoji += ("➡" + clothing_data[i].emoji);
      }
    }
  }  
  
  var desc = createDescription(weather_data, run_data, clothing_data);
  
  title = title + DELIMITER_EMOJI + emoji;
  debug("new title = " + title);
  debug("new description = " + desc);
  
  event.setTitle(title);
  event.setDescription(desc);
}

function getWeatherUndergroundDataFor(api_name, city, state) {
  var url = "http://api.wunderground.com/api/" + KEY_WEATHER_UNDERGROUND + "/" + api_name + "/q/" + state + "/" + city +".json";
  
  var response = getUrl(url);
  
  //debug("getWeatherUndergroundDataFor(" + api_name + ", " + city + ", " + state + "): " + response);
  
  return JSON.parse(response);
}

/**
 * Params:
 *    weather_data: {condition, emoji, temp_f, dewpoint_f, wind_mph, time_of_day}
 *    event_data: {title, description, city, state}
 * Returns: {miles, description, emoji}
 */
function getRunData(weather_data, event_data) {
  // strip off emoji's, to get miles
  var title = event_data.event_data.split(DELIMITER_EMOJI)[0];
  
  // parse title for distance
  var miles = DEFAULT_MILES;
  try {
    var t = title.split(" ");
    for (var i=0; i < t.length; i++) {
      var x = t[i].toUpperCase();
    
      if (x == "MILES" && i != 0) {
        miles = t[i-1];
      }
    }
  } catch (Error) {
    // meh, will just end up with default
    Logger.log("couldn't get miles");
  }
  
  // add miles to data
  // get clothing info: {emoji, head, torso, hands, legs}
  var clothing_data = getClothingData(weather_data, miles);
 
  var run_data = {
    miles: miles
  };
  
  run_data.description = createDescription(weather_data, run_data, clothing_data);

  return run_data;
}

function createDescription(weather_data, run_data, clothing_data) {
  var description = "";
  description += createWeatherDescription(weather_data, run_data, clothing_data);
  description += "<br><br>";
  description += createClothingDescription(weather_data, run_data, clothing_data);
  description += "<br><br>Last Updated: " + Utilities.formatDate(new Date(), "EST", "yyyy-MM-dd HH:mm:ss 'EST'");
  
  debug("description = " + description);
  
  return description;
}

function createWeatherDescription(weather_data, run_data) {
  var description = '<a href="https://www.wunderground.com/hourly/us/'+weather_data[0].state+'/'+weather_data[0].city+'/date/'+weather_data[0].year+"-"+weather_data[0].month+"-"+weather_data[0].day+'">Hourly Forecast</a><br>';
  
  description += createDescriptionFor(weather_data, "🌡", "temp_f", "F");
  description += createDescriptionFor(weather_data, "💦", "dewpoint_f", "F");
  description += createDescriptionFor(weather_data, "🌈", "condition_raw"); // this may not work
  description += createDescriptionFor(weather_data, "🌧", "chance_of_rain", "%");
  description += createDescriptionFor(weather_data, "🌬", "wind_mph", "mph");
  description += createDescriptionFor(weather_data, "🌞", "time_of_day");
  
  debug("description = " + description);
  
  return description;
}

function getForecastForHour(date, city, state) {
  // api docs: https://www.wunderground.com/weather/api/d/docs?d=data/hourly10day
  // example API call: http://api.wunderground.com/api/9d25bfd22c6dc7d5/hourly10day/q/NC/Raleigh.json
  var forecasts = getWeatherUndergroundDataFor("hourly10day", city, state);
  
  // use epoch, but has to be hourly.  clear minutes, seconds
  var x = new Date(date.getTime());
  x.setMinutes(0);
  x.setSeconds(0);
  var epoch = x.getTime() / 1000;
  
  debug("forecast search for date = " + date + ", epoch = " + epoch);
  
  for (var i = 0; i < forecasts.hourly_forecast.length; i++) {
    var forecast = forecasts.hourly_forecast[i];
    
    if (forecast.FCTTIME.epoch == epoch) {
        debug("FORECAST: " + JSON.stringify(forecast));
        return forecast;
    }
  }
  
  // didn't find it.  weird.
  throw new Error("Could not find forecast in '" + city + ", " + state + "' at " + date + ". Raw WU data: " + JSON.stringify(forecasts));
}

/**
 * Returns: [{condition_raw, condition_normalized, emoji, temp_f, dewpoint_f, wind_mph, time_of_day, city, state, year, month, day}] // each element represents one hour, based on length of the event rounded up
 */
function getWeatherData(date, length, city, state) {
  var weather_data = [];
  
  var hour = new Date(date.getTime());
  for (var j = 0; j < length; j++) {
    hour.setHours(hour.getHours() + j);
    // get forecast.  we use caching, so it will only hit WU once.
    var forecast = getForecastForHour(hour, city, state);
    
    var temp = forecast.temp.english;
    var dewpoint = forecast.dewpoint.english;
    var condition = forecast.condition;
    var condition_icon_url = forecast.icon_url;
    var wind_mph = forecast.wspd.english;
    var chance_of_rain = forecast.pop; // https://www.weather.gov/ffc/pop
    
    var time_of_day = getTimeOfDay(date, city, state);
    
    // if night, dawn, or dusk, set emoji first
    var emoji = "";
    
    switch (time_of_day) {
      case "night":
        emoji += "🌛";
        break;
      case "dawn":
      case "dusk":
        emoji += "🌄";
        break;
    }
    
    var conditions = conditionToEmoji(condition);
    emoji += conditions.emoji;
    
    // if windy add wind
    if (wind_mph > LIGHT_WIND_MAX) {
      emoji += "🌬";
    }
    
    // if humid add sweat
    if (dewpoint >= HUMID_DEWPOINT_MIN) {
      emoji += "💦";
    }
    
    weather_data[j] = {
      condition_raw: conditions.raw,
      condition_normalized: conditions.normalized,
      emoji: emoji,
      temp_f: temp,
      dewpoint_f: dewpoint,
      wind_mph: wind_mph,
      time_of_day: time_of_day,
      chance_of_rain: chance_of_rain,
      city: city,
      state: state,
      year: date.getYear(),
      month: date.getMonth() + 1,
      day: date.getDate()
    };
  }
  
  return weather_data;
}

/**
 * return: night, dawn, day, dusk
 */
function getTimeOfDay(date, city, state) {
  // http://api.wunderground.com/api/9d25bfd22c6dc7d5/astronomy/q/NC/Raleigh.json

  var astronomy = getWeatherUndergroundDataFor("astronomy", city, state);
  
  // make sure all dates are on the same day else it's crazy.
  var sunrise = new Date(date);
  sunrise.setHours(astronomy.sun_phase.sunrise.hour);
  sunrise.setMinutes(astronomy.sun_phase.sunrise.minute);
  var sunset = new Date(date);
  sunset.setHours(astronomy.sun_phase.sunset.hour);
  sunset.setMinutes(astronomy.sun_phase.sunset.minute);
  var dusk = new Date(sunset.getTime() + 1000 * 60 * SUNSET_LENGTH_MIN); // actually when dusk ends.
  var dawn = new Date(sunrise.getTime() - 1000 * 60 * SUNRISE_LENGTH_MIN);
  
  debug("find time of day for: " + date);
  debug("dawn: " + dawn);
  debug("sunrise: " + sunrise);
  debug("sunset: " + sunset);
  debug("dusk: " + dusk);
  
  dawn = dawn.valueOf();
  sunrise = sunrise.valueOf();
  sunset = sunset.valueOf();
  dusk = dusk.valueOf();
  date = date.valueOf();

  // order of checks matters
  var time_of_day = "unknown"; // just to have a default

  if (date < dawn) {
    time_of_day = "night";
  } else if (dawn <= date && date < sunrise) {
    time_of_day = "dawn";
  } else if (sunrise <= date && date < sunset) {
    time_of_day = "day";
  } else if (sunset <= date && date < dusk) {
    time_of_day = "dusk";
  } else if (dusk < date) {
    time_of_day = "night";
  }
  
  debug("calculated time of day: " + time_of_day);
  
  return time_of_day;
}

/**
 * Returns: {raw, normalized, emoji}
 */ 
function conditionToEmoji(condition) {
  // https://www.piliapp.com/emoji/list/
  var cond = condition;
  var emoji = "";
  
  var condition_uc = condition.toUpperCase();
  
  var is_chance = (condition_uc.indexOf("CHANCE") > -1);
  var is_light = (condition_uc.indexOf("LIGHT") > -1 || condition_uc.indexOf("PARTIAL") > -1 || condition_uc.indexOf("PATCHES") > -1 || condition_uc.indexOf("SHALLOW") > -1);
  var is_heavy = (condition_uc.indexOf("HEAVY") > -1);
  
  if (is_chance) {
    emoji = "❓";
  }
  
  // order matters.  bad conditions first
   if (condition_uc.indexOf("THUNDERSTORM") > -1) {
     cond = "heavy rain";  // wtw has no lightning
     emoji += "⚡";
  } else if (condition_uc.indexOf("SNOW") > -1 || condition_uc.indexOf("HAIL") > -1 || condition_uc.indexOf("ICE") > -1) {
    cond = "snow";
    emoji += "❄";
  } else if (condition_uc.indexOf("DRIZZLE") > -1) {
    is_light = true;
    is_heavy = false;
    cond = "rain";
  } else if (condition_uc.indexOf("SQUALLS") > -1) {
    is_light = false;
    is_heavy = true;
    cond = "rain";
  } else if (condition_uc.indexOf("RAIN") > -1) {
    cond = "rain";
  } else if (condition_uc.indexOf("FOG") > -1 || condition_uc.indexOf("HAZE") > -1 || condition_uc.indexOf("MIST") > -1) {
    cond = "overcast"; // wtw has no fog
    emoji += "🌫";
  } else if (condition_uc.indexOf("OVERCAST") > -1) {
      cond = "cloudy";
      emoji += "☁";
  } else if (condition_uc.indexOf("CLOUDY") > -1 || condition_uc.indexOf("CLOUDS") > -1) {
      cond = "partly cloudy";
      emoji += "🌤";
  } else if (condition_uc.indexOf("CLEAR") > -1) {
    cond = "clear";
    emoji += "🌞";
  } else {
    // shrug
    emoji = "❓";
  }
  
  if (cond == "rain") {
    // wtw has no "normal" rain, default to light
    if (is_heavy) {
      emoji += "🌨";
      cond = "heavy rain";
    } else {
      emoji += "☔";
      cond = "light rain";
    }
  }
  
  return {raw: condition, normalized: cond, emoji: emoji};
}

