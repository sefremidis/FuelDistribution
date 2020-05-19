
/*
 * This application has 6 basic steps:
 * 1. Select an identity from a wallet
 * 2. Connect to network gateway
 * 3. Access supply chain network
 * 4. Submit transaction
 * 5. Process response
 */

'use strict';

// Bring key classes into scope, most importantly Fabric SDK network class
const json2html = require('node-json2html');
const querystring = require('querystring');
const http = require('http');
const url = require('url');
const fs = require('fs');
const yaml = require('js-yaml');
const { FileSystemWallet, Gateway } = require('fabric-network');
const Client = require('fabric-client')

// A wallet stores a collection of identities for use
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

	//start server
	serve(gateway,contract);

  } catch (error) {

    console.log(`Error processing transaction. ${error}`);
    console.log(error.stack);

  } finally {

    // Disconnect from the gateway
    console.log('Disconnect from Fabric gateway.')

  }
}

async function queryByRange(contract,type) {
	console.log(type)
	if (type != 'Plan' && type != 'Fuel' && type != 'FuelOrder' && type != 'Crude' && type != 'org') {
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
	let reg = /(Plan|Fuel|Crude|FuelOrder|org)[0-9]+/;
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
	let reg = /(Plan|Fuel|Crude|FuelOrder|org)[0-9]+/;
	let ind = asset_id.search(reg);
	if (ind < 0) {
		console.log('wrong asset_id in queryAsset');
		return 'wrong asset_id in queryAsset';
	}
	try {
	let resp = await contract.submitTransaction('queryAsset',asset_id);
		return resp;
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
	let rcoin = Math.floor(Math.random()*2);
	let dest;
	if (rcoin == 0) 
		dest = 'org5';
	else if (rcoin == 1) 
		dest = 'org6';
	return contract.submitTransaction('addFuelOrder','FuelOrder'+fuelOrder_num,value.toString(),quant.toString(),owner,dest,'Fuel'+fuel_num,(new Date()).toISOString())
}

function deliverFuelRand(contract,plan_num,fuelOrders) {
	let trackid = Math.floor(Math.random()*10001) +1;
	let i,dest,rcoin,startLoc,time,estTime,dur;
	startLoc = 'org3';
	dest = 'org5/6';
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
	return contract.submitTransaction('transfer','FuelOrder'+fuelOrder_num,'org5/6',(new Date()).toISOString(),'Plan'+plan_num)
}
function transferCrude(contract,crude_num) {
	return contract.submitTransaction('transfer','Crude'+crude_num,'org3',(new Date()).toISOString())
}
/* a client can make GET request to this server with URLs:
 /Plan , /Fuel, /FuelOrder , /Crude . These commands show all assets that exist e.g Crude1 , Crude2 ... CrudeN 
 /PlanID , /FuelID, /FuelOrderID , /CrudeID . Here ID is a number. These commands show the details of the specific asset e.g. Crude1 , Crude2413 , Plan2312
 /blocks . showing the last commited block.
 /history/AssetID . showing the history of changes in db of this asset (currently not available).
 /org1 /org2 /org3 ... to see the account balance of these orgs.

 */
async function serve(gateway,contract) {
	http.createServer(async function (req, res) {
	  res.writeHead(200, {'Content-Type': 'application/json'});
		let q = url.parse(req.url);
		console.log(q.pathname);
	  if (q.pathname == '/') {
		  res.writeHead(200, {'Content-Type': 'text/html'});
		  res.write('Welcome to Hyperledger monitoring website!\nDownload the /Crude , /Fuel & /Plan files which are located under the root web server dir.\n')
		  return res.end();
	  }
		else if (q.pathname.match('/update')) {
			res.writeHead(200, {'Content-Type': 'application/json'});
			console.log(q.query);
			let params = querystring.parse(q.query);
			console.log(params['m']);
			console.log(params);
			let resp;
			switch (params['m']) {
				case 'deliverCrude':
                  resp = await deliverCrudeRand(contract,params['id']).catch ((e) => {
				  console.log(e);
			      });
                  break;
                case 'transferCrude':
                  resp = await transferCrude(contract,params['id']).catch ((e) => {
				  console.log(e);
			      });
                  break;
                case 'refineRand':
                  resp = await refineRand(contract,params['id'],params['id']).catch ((e) => {
				  console.log(e);
			      });
                  break;
                case 'addFuelOrderRand':
                  resp = await addFuelOrderRand(contract,params['id'],params['id2']).catch ((e) => {
				  console.log(e);
			      });
                  break;
                case 'deliverFuelRand':
                  /*resp = await deliverFuelRand(contract,params['id'],params.slice(2,params.length)).catch ((e) => {
				  console.log(e);
			      });*/
                  break;
                case 'transferFuel':
                  resp = await transferFuel(contract,params['id'],params['id2']).catch ((e) => {
				  console.log(e);
			      });
                  break;
                default:
					res.write('Thats not a valid update option.Please try again.');
					return res.end();
			}
		  return res.end('Update was successful');
		}
	  let regex = /[0-9]+$/;
		let transforms;
		//fix this!
		if (q.pathname.match('/history')) {
			let ret = await queryHistory(contract,q.pathname.slice(9)).catch ((e) => {
			  console.log('err?');
			  console.log(e);
			});
			  let obj = JSON.parse(ret);
			  console.log(obj);
			  res.write(JSON.stringify(obj,null,'\t'));
			  return res.end();
		}
		if (q.pathname.match('/blocks')) {
			let data = fs.readFileSync('blocks','utf-8');
			return res.end(data);
		}
	  let ind = q.pathname.search(regex);
	  let qres;
	  if (ind < 0 ) {
		  res.writeHead(200, {'Content-Type': 'application/json'});
		  let ret = await queryByRange(contract,q.pathname.slice(1)).catch ((e) => {
			  console.log(e);
			  res.write('Could not locate asset');
			  return res.end();
			});
		  let obj = JSON.parse(ret);
		  console.log(obj);
		  //console.log(ret.toJSON());
		  res.write(JSON.stringify(obj,null,'\t'));
		  return res.end();
	  }
	  res.writeHead(200, {'Content-Type': 'application/json'});
		let ret2 = await queryAsset(contract,q.pathname.slice(1)).catch ((e) => {
			  console.log(e);
			  res.write('Could not locate asset');
			  return res.end();
			});
		  let obj2 = JSON.parse(ret2);
			console.log(obj2);
	  res.write(JSON.stringify(obj2,null,'\t'));
	  return res.end();
	}).listen(8080);
	console.log('disconect');
}

main().then(() => {

  console.log('Issue program complete.');

}).catch((e) => {

  console.log('Issue program exception.');
  console.log(e);
  console.log(e.stack);
  process.exit(-1);

});
