/*
weather array structure:
[
  {
    temp_f: float,
    dewpoint_f: float,
    wind_mph: float,
    chance_of_rain: integer,
    condition_raw: string,
    conditions: {
      is_rain: boolean,
      is_snow: boolean,
      is_cloudy: boolean,
      is_thunderstorm: boolean,
      is_chance: boolean,
      is_light: boolean,
      is_heavy: boolean
    },
    emoji: strung,
    
    city: string,
    state: string,
    year: integer,
    month: integer,
    day: integer,
    
    time_of_day: {
      string: string,
      sunrise: string,
      sunset: string,
    },

    time_of_day_string: string,
    time_of_day_sunrise: string,
    time_of_day_sunset: string,
  }
]
*/
