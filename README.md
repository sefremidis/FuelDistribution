Utilzing blockchain and Hyperledger fabric to manage and monitor the supply chain.

IMPORTANT: This project is intented for personal use and will not be maintaned in the future.
The installation process is intented for Debian based platforms only and you may have to make some workarounds to 
build the network correctly for other ones.May the Force be with you!


Prerequisites:
 - Hyperledger fabric 1.4

After installing Fabric, a new directory called fabric-samples/ should exist (propably under go/ directory). 

In order to build the network (Debian based platforms) :
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

1) clone this repo under fabric-samples/ directory
2) $ cd supply_chain_fabric/first-network/supply_chainCode/
3) $ go build all-orgsCC.go
4) copy chaincode directory (supply_chainCode/) under fabric-samples/chaincode/ 
5) navigate under supply_chain_fabric/first-network/ directory
6) $ sudo ./byfn up 
7) $ sudo docker exec -it cli bash 
8) $ cd scripts && ./upgrade.sh 8.0 

In order to make transactions and query the network with the SDK:
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

1) navigate under app/application directory.
2) $ npm install
3) $ node addToWallet.js
4) $ node init.js
Now you are ready to transact with the blockchain. 
5) Run issue.js to update the blockchain and after serve.js to query/update the blockchain.

For more information about the project, see REPORT.pdf

