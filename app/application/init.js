
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

    // Specify userName for network access
    const userName = 'Admin@org1.example.com';

    // Load connection profile; will be used to locate a gateway
    let connectionProfile = yaml.safeLoad(fs.readFileSync('../gateway/networkConnection.yaml', 'utf8'));
	  //
    //let client = Client.loadFromConfig('../gateway/networkConnection.yaml')

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

    console.log('Use scthreediff6 smart contract.');

    const contract = await network.getContract('scthreediff6');

    console.log('Submit initLedger transaction.');
	let resp = await contract.submitTransaction('initLedger');
    console.log(resp)


  } catch (error) {

    console.log(`Error processing transaction. ${error}`);
    console.log(error.stack);

  } finally {

    // Disconnect from the gateway
    console.log('Disconnect from Fabric gateway.')
    gateway.disconnect();

  }
}
main().then(() => {

  console.log('Issue program complete.');

}).catch((e) => {

  console.log('Issue program exception.');
  console.log(e);
  console.log(e.stack);
  process.exit(-1);

});

