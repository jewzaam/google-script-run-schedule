var SHEET_NAME_EMOJI="Emojis";
var CACHE_EMOJI={};

function get_emoji(category, key) {
  var emoji = CACHE_EMOJI[category + "|" + key];
  
  if (emoji == null) {
    debug("get_emoji: building cache");
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME_EMOJI);
    var data = sheet.getRange(2, 1, 100, 3).getValues();
    for (var i = 0; i < data.length; i++) {
      var c = data[i][0]; // category
      var k = data[i][1]; // key
      var e = data[i][2]; // emoji
      
      debug("get_emoji CACHE (" + c + ", " + k + ") = " + e);
      
      if (c == "") {
        // no more data
        break;
      }
      CACHE_EMOJI[c + "|" + k] = e;
    }
    
    emoji = CACHE_EMOJI[category + "|" + key];
  }
  
  debug("get_emoji(" + category + ", " + key + ") = " + emoji);
  
  return emoji;
}
