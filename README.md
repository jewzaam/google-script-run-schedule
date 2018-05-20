# Overview
This is a backup of a google script I wrote because I got tired of looking up weather forecasts and figuring out what I wanted to wear for an upcoming run.  I have since updated it to support setting only weather forecast data.  It's setup for me for what to wear for a run, so your results will vary.

A few things to note:
* Private.gs: you have to suppy your own weather underground API key
* Calendar.gs: OUTSIDE_EVENT_COLOR sets the color of an event that means it's outdoors.. modify as needed
* Calendar.gs: if the event has word "run" or "yoga" a reminder is set at 7PM the day before

This is a complete hack and I've thought about rewriting it.  But it's working for me, so will probably just stop here for now.


# Using

1. Create a google script project.
2. Create the scripts and copy them in.
3. Get a Weather Underground API Key and set in Private.gs.
4. Run the "Install" function.
5. For any outdoor activity you want a forecast for, set the color to "Peacock" and location to "<City>, <State>".
