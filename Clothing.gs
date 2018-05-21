var WTW_GENDER="m"; // m=male, f=female
var WTW_FEEL="ib"; // c=cool, ib=in between, w=warm

function createClothingDescription(weather_data, run_data, clothing_data) {
  if (clothing_data != null && clothing_data.length > 0) {
    
    var description = "<a href=\"" + clothing_data[0].wtw_url + "\">What to Wear</a><br>";
    
    description += createDescriptionFor(clothing_data, "Head", "head");
    description += createDescriptionFor(clothing_data, "Torso", "torso");
    description += createDescriptionFor(clothing_data, "Hands", "hands");
    description += createDescriptionFor(clothing_data, "Legs", "legs");
    
    debug("description = " + description);
    
    return description;
  } else {
    return "";
  }
}

function extractClothing(from, what) {
  //debug("extractClothing: from = " + from);
  //debug("extractClothing: what = " + what);
  var regexp = new RegExp("<img[^>]+src=\"[^\"]+/m_"+what+"_([^/\"]+)\.png\"[^>]+title=\""+what+"\"[^>]+>");
  
  var raw = regexp.exec(from)[1];
  var clean;
  
  switch (raw) {
    case "hat":
      clean = "Visor";
      break;
      
    case "wintercap":
      clean = "Winter Cap";
      break;
      
    case "wintercap_sunglasses":
      clean = "Winter Cap";
      break;
      
    case "bare_sunglasses":
      clean = "Bare";
      break;

    case "lsgloves":
      clean = "Long Sleeves"; // gloves will be added by other logic based on temp
      break;
    
    case "ls":
      clean = "Long Sleeves";
      break;
      
    case "lightjacket":
      clean = "Light Jacket";
      break;
    
    case "heavyjacket":
      clean = "Heavy Jacket";
      break;

    case "ss":
      clean = "Short Sleeves";
      break;
    
    default:
      // capitalize whatever it is
      var c_regex = new RegExp("(.)(.*)");
      var x = c_regex.exec(raw);
      clean = x[1].toUpperCase() + x[2];
      //debug("Converted '" + raw + "' to '" + clean + "'.");
  }
  
  return clean;
}

/**
 * Params:
 *    data: [{temp_f, condition_raw, condition_normalized, wind_mph, time_of_day, emoji, dewpoint_f, miles]]
 * Returns: [{emoji, head, torso, hands, legs, wtw_url}]
 */
function getClothingData(weather_data, miles) {
  var clothing_data = [];

  for (var i = 0; i < weather_data.length; i++) {
    var data = weather_data[i];
    
    var temp = data.temp_f;
    var dewpoint = data.dewpoint_f;
    var condition = data.condition_normalized;
    var wind = data.wind_mph;
    var time = data.time_of_day;
    var distance = miles;
    
    // trick to get HTML in description at the time of writing this is to have a url or email address
    var wtw_url = createWhatToWearURL(temp, condition, wind, time, distance);
    
    var clothing_emoji = "";
    
    // get the page from runner's world
    var response = getUrl(wtw_url);
    
    // strip out what just the picture
    // it's the chunk of 4 image tags one after another.
    var head = extractClothing(response, "head");
    var torso = extractClothing(response, "torso");
    var hands = "Bare";
    var legs = extractClothing(response, "legs");
    var feet = extractClothing(response, "feet");
    
    switch (head) {
      case "Bare":
        if (distance > MAX_EASY_RUN_MILES) {
          head = "Headband";
          if (time == "day") {
            head += " + Sunglasses";
            clothing_emoji += "🕶";
          }
        }
        break;
      case "Visor":
      case "Hat":
        clothing_emoji += "🧢";
        break;
    }
    
    switch (torso) {
      case "Bare":
      case "Singlet":
        torso = "Singlet";
        clothing_emoji += "🎽";
        break;
      case "Short Sleeves":
        clothing_emoji += "👕";
        break;
      case "Long Sleeves":
        clothing_emoji += "🥋";
        break;
      case "Light Jacket":
        clothing_emoji += "🧥";
      case "Heavy Jacket":
        clothing_emoji += "🧥🧥";
        break;
    }      
    
    if (35 < temp && temp <= 50) {
      hands = "Gloves";
      clothing_emoji += "🧤";
    } else if (20 < temp && temp <= 35) {
      hands = "Mittens";
      clothing_emoji += "🧤🧤";
    } else if (temp <= 20) {
      clothing_emoji += "🧤🧤🧤";
    }
    
    if (legs == "Tights") {
      if (temp >= 40) {
        legs = "Long Pants";
        clothing_emoji += "👖";
      } else {
        clothing_emoji += "👖👖";
      }
    }
    
    clothing_data[i] = {
      emoji: clothing_emoji,
      head: head,
      torso: torso,
      hands: hands,
      legs: legs,
      wtw_url: wtw_url
    };
  }
  
  return clothing_data;
}

function createWhatToWearURL(temp, condition, wind, time, distance) {
  // https://www.runnersworld.com/what-to-wear?gender=m&temp=20&conditions=c&wind=lw&time=day&intensity=n&feel=ib
  var url = "https://www.runnersworld.com/what-to-wear?"
  
  url += "gender=" + WTW_GENDER;

  // temp is in increments of 5
  debug("temp before split = " + temp);
  debug("temp / 5 = " + (temp / 5));
  url += "&temp=" + (Math.floor(temp / 5) * 5);

  // conditions
  url += "&conditions=";
  switch (condition) {
  case "partly cloudy":
    url += "pc";
    break;
  case "cloudy":
    url += "o";
    break;
  case "light rain":
    url += "lr";
    break;
  case "heavy rain":
    url += "r";
    break;
  case "snow":
    url += "s";
    break;
  case "clear":
  default:
    url += "c";
  }

  if (wind <= LIGHT_WIND_MAX) {
    // light wind
    url += "&wind=lw";
  } else {
    // heavy wind
    url += "&wind=hw";
  }

  // time
  url += "&time=" + time;

  if (distance <= MAX_EASY_RUN_MILES) {
    // easy/normal
    url += "&intensity=n";
  } else {
    // long run
    url += "&intensity=lr";
  }
  
  
  url += "&feel=" + WTW_FEEL;
  
  
  return url;
}

