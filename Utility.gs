var SUNRISE_LENGTH_MIN=30;
var SUNSET_LENGTH_MIN=30;

var HUMID_DEWPOINT_MIN=70;
var LIGHT_WIND_MAX=9; // max wind (mph) for "light wind"
var MAX_EASY_RUN_MILES=5; // max distance (miles) for an "easy" run

var DEFAULT_CITY = "Fuquay-Varina";
var DEFAULT_STATE = "NC";
var DEFAULT_MILES = MAX_EASY_RUN_MILES - 1; // default to less than max easy run

var DELIMITER_EMOJI = "|";

var CACHE = {};

function debug(msg) {
  Logger.log(msg);
}

function getUrl(url) {
  var response = CACHE[url];
  
  if (response == null) {
    debug("fetching data, adding to cache: " + url);
    response = UrlFetchApp.fetch(url);
    CACHE[url] = response;
  } else {
    debug("using cache: " + url);
  }
  
  return response;
}

function createDescriptionFor(data, label, key, uom) {
  var output = "<strong>" + label + "</strong>: ";
  
  for (var i = 0; i < data.length; i++) {
    output += data[i][key];
    if (uom != null) {
      output += (" " + uom);
    }
    if (i+1 < data.length) {
      output += " ➡ "
    }
  }
  
  output += "<br>";
  
  return output;
}


