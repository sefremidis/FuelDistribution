/*
SPDX-License-Identifier: Apache-2.0
*/

/*
 * This application has 6 basic steps:
 * 1. Select an identity from a wallet
 * 2. Connect to network gateway
 * 3. Access PaperNet network
 * 4. Construct request to issue commercial paper
 * 5. Submit transaction
 * 6. Process response
 */

/*
 * TODO: create a web server and a client can query Asset by ID or Byrange. How many blocks are produced until now. 
 *
 *
 *
 *
 */

'use strict';

// Bring key classes into scope, most importantly Fabric SDK network class
const json2html = require('node-json2html');
const http = require('http');
const url = require('url');
const fs = require('fs');
const yaml = require('js-yaml');
const { FileSystemWallet, Gateway } = require('fabric-network');
const Client = require('fabric-client')
//const CommercialPaper = require('../contract/lib/paper.js');

// A wallet stores a collection of identities for use
//const wallet = new FileSystemWallet('../user/isabella/wallet');


const wallet = new FileSystemWallet('../identity/user/loukas/wallet');






// Main program function
async function main() {
  // A gateway defines the peers used to access Fabric networks
  const gateway = new Gateway();

  // Main try/catch block
  try {
    const userName = 'Admin@org1.example.com';

    // Load connection profile; will be used to locate a gateway
    let connectionProfile = yaml.safeLoad(fs.readFileSync('../gateway/networkConnection.yaml', 'utf8'));

    // Set connection options; identity and wallet
    let connectionOptions = {
      identity: userName,
      wallet: wallet,
      discovery: { enabled:false, asLocalhost: true }
    };

    // Connect to gateway using application specified parameters
    console.log('Connect to Fabric gateway.');

    await gateway.connect(connectionProfile, connectionOptions);

    console.log('Use network channel: mychannel.');

    const network = await gateway.getNetwork('mychannel');

    console.log('Use org.papernet.commercialpaper smart contract.');

    const contract = await network.getContract('scthreediff6');

    console.log('Submit commercial paper issue transaction.');

    const listener = await network.addBlockListener('my-block-listener', (error, block) => {
    if (error) {
        console.error(error);
        return;
    }
		let data =  '\nblock_number: ' + block.header.number+', block_data_hash: '+block.header.data_hash+ ',block_previous_hash: ' +block.header.previous_hash + '\n';
		fs.writeFile('blocks',data,(err)=> {
		  if (err) console.log(err);
		  console.log("Successfully Written to File.");
		});
    console.log(`Block: ${block}`);
	});
	//if user has supplied args then we assume he wants to make a single tx.
	  //if not, then we multiple txs will be made (see the loop below).
	  var args = process.argv.slice(2);
	  if (args.length >= 2) {
		  let resp;
		  console.log(args);
		  switch (args[0]) {
			  case 'deliverCrude':
				resp = await deliverCrudeRand(contract,args[1]);
				break;
			  case 'transferCrude':
				resp = await transferCrude(contract,args[1]);
				break;
			  case 'refineRand':
				resp = await refineRand(contract,args[1],args[1]);
				break;
			  case 'addFuelOrderRand':
				resp = await addFuelOrderRand(contract,args[1],args[2]);
				break;
			  case 'deliverFuelRand':
				resp = await deliverFuelRand(contract,args[1],args.slice(2));
				break;
			  case 'transferFuel':
				resp = await transferFuel(contract,args[1],args[2]);
				break;
			  default:
				  console.log('Command line args are not good! Usage: node issue.js <transaction> <arg0> <arg1> ... <argN> ');
		  }
		  gateway.disconnect();
		  return;
	  }

	let init_id = 0;
	let i;
	let forder_count = 1;
    let resp;
	  //submit transactions .
	  //create Crude oil ->transfer -> refine -> create fuelOrder(s) -> deliver orders -> transfer fuel to retailers.
	for (i = 1;i < 5; i++) {
		resp = await deliverCrudeRand(contract,i);
		console.log(resp);
	
		resp = await transferCrude(contract,i)
		console.log(resp);
		resp = await refineRand(contract,i,i);
		console.log(resp);
		resp = await addFuelOrderRand(contract,forder_count++,i);
		console.log(resp);
		
		resp = await addFuelOrderRand(contract,forder_count++,i);
		console.log(resp);
		resp = await addFuelOrderRand(contract,forder_count++,i);
		console.log(resp);
		let forders = [forder_count-3,forder_count-2,forder_count-1]
		console.log(resp);
		resp = await deliverFuelRand(contract,i,forders);
		console.log(resp);
		resp = await transferFuel(contract,forders[0],i)
		console.log(resp);
		console.log(resp);
	}

  } catch (error) {

    console.log(`Error processing transaction. ${error}`);
    console.log(error.stack);

  } finally {

    // Disconnect from the gateway
    console.log('Disconnect from Fabric gateway.')
    gateway.disconnect();

  }
}
async function queryByRange(contract,type) {
	console.log(type)
	if (type != 'Plan' && type != 'Fuel' && type != 'FuelOrder' && type != 'Crude') {
		console.log('wrong type in queryByRange');
		return 'wrong type in queryByRange';
	}
	try {
		let resp = await contract.submitTransaction('queryAssetByRange',type);
		let data = resp.toString()
		fs.writeFile(type+'s',data,(err) => {
		  if (err) console.log(err);
		  console.log("Successfully Written to File.");
		});
		return resp;
	}
	catch (error) {
		console.log(`Error processing transaction. ${error}`);
		console.log(error.stack);

	}
}

function queryByRange2(contract,type) {
	console.log(type)
	if (type != 'Plan' && type != 'Fuel' && type != 'FuelOrder' && type != 'Crude') {
		console.log('wrong type in queryByRange');
		return 'wrong type in queryByRange';
	}
	try {
		let resp = contract.submitTransaction('queryAssetByRange',type);
		let data = resp.toString()
		fs.writeFile(type+'s',data,(err) => {
		  if (err) console.log(err);
		  console.log("Successfully Written to File.");
		});
		return resp;
	}
	catch (error) {
		console.log(`Error processing transaction. ${error}`);
		console.log(error.stack);

	}
}
async function queryHistory(contract,asset_id) {
	let reg = /(Plan|Fuel|Crude|FuelOrder)[0-9]+/;
	let ind = asset_id.search(reg);
	if (ind < 0) {
		console.log('wrong asset_id in queryHistory');
		return 'wrong asset_id in queryHistory';
	}
	try {
	let resp = await contract.submitTransaction('queryHistoryForKey',asset_id);
		return resp;
	//respond to client 
	}
	catch (error) {
		console.log(`Error processing transaction. ${error}`);
		console.log(error.stack);
	}
}


async function queryAsset(contract,asset_id) {
	let reg = /(Plan|Fuel|Crude|FuelOrder)[0-9]+/;
	let ind = asset_id.search(reg);
	if (ind < 0) {
		console.log('wrong asset_id in queryAsset');
		return 'wrong asset_id in queryAsset';
	}
	try {
	let resp = await contract.submitTransaction('queryAsset',asset_id);
		return resp;
	//respond to client 
	}
	catch (error) {
		console.log(`Error processing transaction. ${error}`);
		console.log(error.stack);
	}
}


function deliverCrude(contract,crude_num,value,quant,owner,estTime,startLoc,dest,vessel_id) {
	return contract.submitTransaction('deliverCrude','Crude'+crude_num,value,quant,'org'+owner,estTime,dest,vessel_id)
}


function deliverCrudeRand(contract,crude_num) {
	let value = Math.floor(Math.random()*101) +1;
	let quant = Math.floor(Math.random()*101) +1;
	let owner = 'org1';

	let dur = Math.floor(Math.random()*101) +1;
	let time = new Date();
	time.setSeconds(time.getSeconds() + dur)
	let estTime = time.toISOString();
	let startLoc = owner;
	let dest = 'org3';
	let vessel_id = Math.floor(Math.random()*1001) +1;
	return contract.submitTransaction('deliverCrude','Crude'+crude_num,value.toString(),quant.toString(),owner,estTime,startLoc,dest,vessel_id.toString(),(new Date()).toISOString())
}

function refineRand(contract,fuel_num,crude_num) {
	let value = Math.floor(Math.random()*101) +1;
	let quant = Math.floor(Math.random()*101) +1;
	let owner = 'org3';
	let density = Math.floor(Math.random()*101) +1;
	let type = 'fuel';
	return contract.submitTransaction('refine','Fuel'+fuel_num,value.toString(),quant.toString(),owner,density.toString(),type,'Crude'+crude_num,(new Date).toISOString())
}

function addFuelOrderRand(contract,fuelOrder_num,fuel_num) {
	let value = Math.floor(Math.random()*101) +1;
	let quant = Math.floor(Math.random()*101) +1;
	let owner = 'org3';
	let dest;
	let rcoin = Math.floor(Math.random()*2);
	if (rcoin == 0) 
		dest = 'org5';
	else if (rcoin == 1) 
		dest = 'org6';
	return contract.submitTransaction('addFuelOrder','FuelOrder'+fuelOrder_num,value.toString(),quant.toString(),owner,dest,'Fuel'+fuel_num,(new Date()).toISOString())
}

function deliverFuelRand(contract,plan_num,fuelOrders) {
	let trackid = Math.floor(Math.random()*10001) +1;
	let i,dest,startLoc,time,estTime,dur;
	startLoc = 'org3';
	let rcoin = Math.floor(Math.random()*2);
	if (rcoin == 0) 
		dest = 'org5';
	else if (rcoin == 1) 
		dest = 'org6';
	let args_arr = ['deliverFuel','Plan'+plan_num,trackid.toString()]
	for (i = 0; i < fuelOrders.length; i++) {
		dur = Math.floor(Math.random()*101) +1;
		time = new Date();
		time.setSeconds(time.getSeconds() + dur)
		estTime = time.toISOString();
		args_arr.push('FuelOrder'+fuelOrders[i],estTime,startLoc,dest)
	}
	return contract.submitTransaction(...args_arr)
}

function transferFuel(contract,fuelOrder_num,plan_num) {
	let rcoin = Math.floor(Math.random()*2);
	let dest;
	if (rcoin == 0) 
		dest = 'org5';
	else if (rcoin == 1) 
		dest = 'org6';
	return contract.submitTransaction('transfer','FuelOrder'+fuelOrder_num,dest,(new Date()).toISOString(),'Plan'+plan_num)
}
function transferCrude(contract,crude_num) {
	return contract.submitTransaction('transfer','Crude'+crude_num,'org3',(new Date()).toISOString())
}

main().then(() => {

  console.log('Issue program complete.');

}).catch((e) => {

  console.log('Issue program exception.');
  console.log(e);
  console.log(e.stack);
  process.exit(-1);

});
