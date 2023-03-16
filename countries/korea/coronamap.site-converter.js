// Convert data from coronamap.site.
//
// The JSON file is here: https://coronamap.site/javascripts/ndata.js
//
//   # This is mandatory!
//   % cd countries/korea/
//
//   % export INPUT="coronamap.site-input.js"
//   % export OUTPUT="coronamap.site-output.json"
//
//   # Download the data file and manipulate a little bit.
//   % wget https://coronamap.site/javascripts/ndata.js -O "${INPUT}"
//   % echo "module.exports.position = position;" >> "${INPUT}"
//
//   % nodejs coronamap.site-converter.js \
//       -i "${INPUT}" \
//       -o "${OUTPUT}"
//
// TOOD: link back to the particular record on the coronamap.site.

const fs = require("fs");
const yargs = require("yargs");

const meta = require("../../meta.js");
const utils = require("./utils");

const STDOUT = process.stdout;
const STDERR = process.stderr;

const argv = yargs
    .option('input', {
        alias: 'i',
        description: 'Specify the input filename',
        type: 'string',
    })
    .option('meta', {
        alias: 'm',
        description: 'Specify the meta filename',
        type: 'string',
    })
    .option('output', {
        alias: 'o',
        description: 'Specify the output filename',
        type: 'string',
    })
    .option('pretty', {
        description: 'Pretty output',
        type: 'boolean',
    })
    .help()
    .alias('help', 'h')
    .argv;

///// Start of program //////

// mock up naver.maps.LatLng() so that it just return the lat/lng pair.
naver = new Object();  // intented to set it in global variable.
naver.maps = new Object();
naver.maps.LatLng = function(lat, lng) {
  return [lat, lng];
};

const ndata = require('./' + argv.input);
// Now data are loaded into 'ndata.position' !!!

let meta_file = meta.Meta(argv.meta);

// An input record is like:
//   [
//     {
//       status: "완치",
//       profile: "(55.남.한국)",
//       tag: "#우한방문",
//       memo:
//         "<span style='font-size:12px !important;'>  접촉자 <span style='color:red;'>95명</span></span>",
//       color: "blue",
//       month: 1,
//       day: 20,
//       date: "1/20",
//       address: "인천 공항 도착",
//       title: "4번째 확진자",
//       latlng: new naver.maps.LatLng(37.460459, 126.44068)
//     },
//     {
//       color: "blue",
//       month: 1,
//       day: 20,
//       date: "1/20",
//       address: "평택 송탄터미널",
//       title: "4번째 확진자",
//       latlng: new naver.maps.LatLng(37.07994, 127.058282)
//     },
//   ],
//
// Another example,
//
//   [
//     {
//       // profile: "(중국 관광객)",
//       // tag: "#우한방문",
//       month: 1,
//       day: 21,
//       color: "rgb(16, 181, 247)",
//       date: "1/21",
//       address: "제주국제공항 도착<br>제주시호텔 이용",
//       title: "제주도 중국인 관광객",
//       latlng: new naver.maps.LatLng(33.511165, 126.490914)
//     },
//
// What we care:
//
//   {
//     "placeVisit" : {
//       "location" : {
//         "latitudeE7" : latlng[0] * 10000000,
//         "longitudeE7" : latlng[1] * 10000000,
//         "name" : title,
//       },
//       "duration" : {
//         "startTimestampMs" : str(t),
//         "endTimestampMs" : str(t + 86400 * 1000),
//       },
//     }
//   }
//
let out_obj = [];
for(let record of ndata.position) {
  // latlng can be either naver.maps.LatLng() or a string "37.47700115295818, 126.96292928072465"
  let latlng = record.latlng;
  if (typeof latlng == "string") {
    latlng = latlng.split(",");
    latlng = [parseFloat(latlng[0]), parseFloat(latlng[1])];
  }

  // Year is not specified in data source, should be 2020.
  const timestamp = utils.KrDateToTimestampMs(2020, record.month, record.day);

  let lat = Math.round(latlng[0] * 1e7);
  let lng = Math.round(latlng[1] * 1e7);
  meta_file.insert_bounding_box(lat, lng);

  out_obj.push({
    placeVisit: {
      location: {
        latitudeE7: lat,
        longitudeE7: lng,
        name : record.name,
      },
      duration: {
        startTimestampMs: timestamp,
        endTimestampMs: timestamp + 24 * 60 * 60 * 1000,  // The whole day.
      },
    }
  });
}

let space = argv.pretty ? 2 : 0;
let out_text = JSON.stringify({
  timelineObjects: out_obj,
}, null, space);

// Output to medium.
if (argv.output != undefined) {
  fs.writeFile(argv.output, out_text, function (err) {
    if (err) throw err;
  });
} else {
  STDOUT.write(out_text);
}

meta_file.output();

// Show some numbers.
STDERR.write("OUTPUT: " + out_obj.length + " records, " +
                          out_text.length + " bytes.\n");
