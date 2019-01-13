var DATA_CLOTHING = null;


function get_clothing_for(weather) {
  debug("get_clothing_for");
  var clothing = [];
  
  for (var c = 0; c < weather.length; c++) {
    debug("get_clothing_for: " + JSON.stringify(weather[c]));
    clothing[c] = {};
  
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
      
      var relative_temp_f = weather[c]["relative_temp_f"];
      
      debug("where: " + where);
      debug("what: " + what);
      debug("min_temp_f: " + min_temp_f);
      debug("max_temp_f: " + max_temp_f);
      debug("condition: " + condition);
      debug("weather["+(c)+"][conditions][condition]: " + weather[c]["conditions"][condition]);
      
      if (where == null || where == "") {
        break;
      }
      
      if ((min_temp_f == null || min_temp_f == "" || min_temp_f <= relative_temp_f) &&
          (max_temp_f == null || max_temp_f == "" || relative_temp_f < max_temp_f) &&
          (condition == null || condition == "" || weather[c]["conditions"][condition])) {
          debug("match: true");
          
          var x = clothing[c][where];
          
          // have a match, add the clothing
          if (x == null || x == "") {
            x = [];
          }
          x[x.length] = what;
          
          clothing[c][where] = x;
      } else {
        debug("match: false");
      }
    }
  }
  
  debug("clothing: " + JSON.stringify(clothing));
  
  return clothing;
}

function get_clothing_title(clothing) {
  return "";
}

function get_clothing_description(clothing) {
  var description = "";

  description += create_description_data(clothing, "head", null, true);
  description += create_description_data(clothing, "torso", null, true);
  description += create_description_data(clothing, "hands", null, true);
  description += create_description_data(clothing, "legs", null, true);
  
  debug("get_clothing_description = " + description);
  
  return description;
}
