# Overview
This is a backup of a google script I wrote because I got tired of looking up weather forecasts and figuring out what I wanted to wear for an upcoming run.  Data for configuration, weather adjustments for clothing, and cloting preferences are managed in a spreadsheet.  I haven't made a template of that yet, but will update this when I have that.

# Using

OUT OF DATE!

1. Create a google script project.
1. Set timezone in script properties.
1. Create the scripts and copy them in.
1. Get a Weather Underground API Key and set in Private.gs.
1. Run the "Install" function.
1. For any outdoor activity you want a forecast for, set the color to "Peacock" and location to "<City>, <State>".
1. Customize location of legend if you change something.

# Uploading Legend to S3

Start file upload and..

1. select legend.html file
2. set permission to allow public read
3. define header `Content-Type` with value `text/html; charset=utf-8`
