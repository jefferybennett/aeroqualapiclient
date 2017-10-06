# API Aeroqual Client script

## Setting up
First, using a terminal window, clone the GitHub repo ...
```
git clone https://github.com/jefferybennett/aeroqualapiclient.git
```
Next, change directories into the newly created one ...
```
cd aeroqualapiclient
```
Next, restore the Node packages needed to run the script ...
```
npm install
```
Finally, create the .env file described below.

## Environment File
Before running the script, create a file titled ".env" and provide the following text with values.
```text
AeroqualAPIUrl=dev.cloud.aeroqual.com
AeroqualUserName=
AeroqualPassword=
AzureIoTHubOwnerConnectionString=
OutputLogs=true
```

## Running the script
To run the script, simply execute the folloiwing command in the root of the directory in a terminal window...
```
node .
```