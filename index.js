/*
MIT License

Copyright (c) 2017 Jeff Bennett

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

const result = require("dotenv").config();

if (result.error) {
    throw result.error;
}

var http = require("http");
var querystring = require("querystring");
var iotHub = require("azure-iothub");
var clientFromConnectionString = require('azure-iot-device-http').clientFromConnectionString;
var iotMessage = require("azure-iot-device").Message;
var async = require("async");

try {   
    main();
    return 0;
}
catch(e) {
    console.log(e.description);
}

function main() {

    var timeStamp = new Date().toISOString();
    var loginCookie;
    var startTime, endTime;
    var test = getProcessVariable("AeroqualPassword");
    //var outputLogs = (process.env.OutputLogs == true);
    var outputLogs = true;

    console.log("** OPERATION STARTED **");

    //if(myTimer.isPastDue)
    //{
    //    context.log('JavaScript is running late!');
    //}

    async.waterfall([
        function(mainCB) {
            login(function(cookie) {
                loginCookie = cookie;
                if (outputLogs) { console.log("#1 - Login - Complete"); }
                mainCB(null);
            });
        },
        function(mainCB) {
            getDevices(loginCookie, function(devices) {
                if (outputLogs) { console.log("#2 - Get Devices - ".concat(devices.length).concat(" identified - Complete")); }
                mainCB(null, devices);
            });
        },
        function(devices, mainCB) {
            async.eachSeries(devices, function(deviceId, deviceLoopCB) {
                startTime = addMinutes(new Date(), -10);
                endTime = new Date();

                async.waterfall([
                    function(deviceImportCB) {
                        getDeviceData(loginCookie, deviceId, startTime, endTime, deviceImportCB, function(serialData, deviceImportCB) {
                            if (outputLogs) { console.log("#3 - Get Device Data for ".concat(deviceId).concat(" - Complete")); }
                            deviceImportCB(null, deviceId, serialData);
                        });
                    },
                    function(deviceId, serialData, deviceImportCB) {
                        registerDeviceWithIoTHub(deviceId, function(deviceInfo) {
                            if (outputLogs) { console.log("#4 - Register Device for ".concat(deviceId).concat(" - Complete")); }
                            deviceImportCB(null, deviceId, serialData, deviceInfo);
                        });
                    },
                    function(deviceId, serialData, deviceInfo, deviceImportCB) {
                        if (serialData.data == null) {
                            throw Error(serialData);
                        } else {
                            if (serialData.data.length == 0) {
                                if (outputLogs) { console.log("#5 - No data to upload for ".concat(deviceId).concat(" - Skipping Upload")); }
                                deviceImportCB(null);
                            } else {
                                batchDeviceDataUpload(deviceId, deviceInfo, serialData, function(err, result) {
                                    if (outputLogs) { console.log("#5 - Batch Upload for ".concat(deviceId).concat(" - Complete")); }
                                    deviceImportCB(null);
                                });
                            }
                        }
                    }
                ], function(err, result) {
                    if(err) { console.log("Exception1: " + err); }
                    deviceLoopCB(null);
                });

            }, function(err) {
                if(err) { console.log("Exception2: " + err); }
                mainCB(null);
            });
        }
    ], function (err, result) {
        if(err) { console.log("Exception3: " + err); }
        if (outputLogs) { console.log("** OPERATION COMPLETE **"); }
    });

    //context.done();

    return 0;

}

function getProcessVariable(name) {
    return process.env[name];
}

function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes*60000);
}

function getDeviceIoTHubConnectionString(deviceId, key) {
    var iotHubOwnerConnectionString = getProcessVariable("AzureIoTHubOwnerConnectionString");
    var hostName = iotHubOwnerConnectionString.split(";")[0].split("=")[1];
    return "HostName=".concat(hostName).concat(";DeviceId=").concat(deviceId).concat(";SharedAccessKey=").concat(key);
}

if (Date.prototype.toISOString) {
    (function() {
  
      function pad(number) {
        if (number < 10) {
          return '0' + number;
        }
        return number;
      }

      Date.prototype.toISOString = function() {
        this.setHours(this.getHours() - 1);
        return this.getFullYear() +
          '-' + pad(this.getMonth() + 1) +
          '-' + pad(this.getDate()) +
          'T' + pad(this.getHours()) +
          ':' + pad(this.getMinutes()) +
          ':' + pad(this.getSeconds()) +
          '.' + (this.getMilliseconds() / 1000).toFixed(3).slice(2, 5);
      };
  
    }());
  }

function login(callback) {

    var url = getProcessVariable("AeroqualAPIUrl");   
    var userName = getProcessVariable("AeroqualUserName");
    var passWord = getProcessVariable("AeroqualPassword");
    var setCookie;

    const postData = querystring.stringify({
        'UserName': userName,
        'Password': passWord
    });
      
    const options = {
        hostname: url,
        port: 80,
        path: '/api/account/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
    };
      
    const req = http.request(options, (res) => {
        //console.log(`STATUS: ${res.statusCode}`);
        //console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
        res.setEncoding('utf8');

        res.on('data', (chunk) => {
            console.log(`BODY: ${chunk}`);
        });

        res.on('end', () => {
            //console.log('No more data in response.');
            setCookie = res.headers["set-cookie"][0];
            return callback(setCookie);
        });

    });
      
    req.on('error', (e) => {
        console.error(`problem with request: ${e.message}`);
    });
    
    // write data to request body
    req.write(postData);
    req.end();

}

function getDevices(cookie, callback) {

    var url = getProcessVariable("AeroqualAPIUrl");
    var data = "";
      
    const options = {
        hostname: url,
        port: 80,
        path: '/api/instrument',
        method: 'GET',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'cookie': cookie
        }
    };
      
    const req = http.request(options, (res) => {
        res.setEncoding('utf8');

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            return callback(JSON.parse(data));
        });

    });
      
    req.on('error', (e) => {
        console.error(`problem with request: ${e.message}`);
    });
    
    // write data to request body
    req.end();

}

function getDeviceData(cookie, serial, starttime, endtime, asyncCB, callback) {

    var url = getProcessVariable("AeroqualAPIUrl");
    var data = "";
    var path = "/api/data/" + serial + "?from=" + starttime.toISOString() + "&to=" + endtime.toISOString() + 
            "&averagingperiod=1&includejournal=false";
      
    const options = {
        hostname: url,
        port: 80,
        path: path,
        method: 'GET',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'cookie': cookie
        }
    };
      
    const req = http.request(options, (res) => {
        //console.log(`STATUS: ${res.statusCode}`);
        //console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
        res.setEncoding('utf8');

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            //console.log('No more data in response.');
            return callback(JSON.parse(data), asyncCB);
        });

        res.on('error', (e) => {
            console.error(`problem with request: ${e.message}`);
        })

    });
      
    req.on('error', (e) => {
        console.error(`problem with request: ${e.message}`);
    });
    
    // write data to request body
    req.end();

}

function batchDeviceDataUpload(deviceId, deviceInfo, deviceData, callback) {
    var deviceDataArray = deviceData.data;
    var client = clientFromConnectionString(getDeviceIoTHubConnectionString(deviceId, deviceInfo.authentication.symmetricKey.primaryKey));
    var messages = [];

    for (var i = 0; i < deviceDataArray.length; i++) {
        var deviceData = deviceDataArray[i];
        var messageData = JSON.stringify({ "deviceId": deviceId, deviceData });
        var message = new iotMessage(messageData);
        messages.push(message);
    };
    
    client.sendEventBatch(messages, function(err, result) {
        return callback(err, result);
    })

}

function registerDeviceWithIoTHub(deviceId, callback) {
    var iotHubConnectionString = getProcessVariable("AzureIoTHubOwnerConnectionString");
    var registry = iotHub.Registry.fromConnectionString(iotHubConnectionString);
    var device = {
        deviceId: deviceId
      };

    registry.create(device, function (err, deviceInfo, res) {
        if (err) {
            registry.get(device.deviceId, function registryGetHandler(err, deviceInfo, res) {
                if (deviceInfo) {
                    //deviceToRegister.deviceKey = deviceInfo.authentication.SymmetricKey.primaryKey;
                    return callback(deviceInfo);
                }
                return callback(null);
            });
        }
        else { 
            return callback(deviceInfo);
        }
    });
}