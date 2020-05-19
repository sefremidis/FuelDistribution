#!/bin/bash

echo
echo " ____    _____      _      ____    _____ "
echo "/ ___|  |_   _|    / \    |  _ \  |_   _|"
echo "\___ \    | |     / _ \   | |_) |   | |  "
echo " ___) |   | |    / ___ \  |  _ <    | |  "
echo "|____/    |_|   /_/   \_\ |_| \_\   |_|  "
echo
echo "Build your first network (BYFN) end-to-end test"
echo
CHANNEL_NAME="$1"
DELAY="$2"
LANGUAGE="$3"
TIMEOUT="$4"
VERBOSE="$5"
: ${CHANNEL_NAME:="mychannel"}
: ${DELAY:="3"}
: ${LANGUAGE:="golang"}
: ${TIMEOUT:="10"}
: ${VERBOSE:="false"}
LANGUAGE=`echo "$LANGUAGE" | tr [:upper:] [:lower:]`
COUNTER=1
MAX_RETRY=10

CC_SRC_PATH="github.com/chaincode/supply_chain/supply_chain_CC/twoOrgs/"
CC_SRC_PATH2="github.com/chaincode/supply_chainCode/"

if [ "$LANGUAGE" = "node" ]; then
	CC_SRC_PATH="/opt/gopath/src/github.com/chaincode/chaincode_example02/node/"
fi

if [ "$LANGUAGE" = "java" ]; then
	CC_SRC_PATH="/opt/gopath/src/github.com/chaincode/chaincode_example02/java/"
fi

echo "Channel name : "$CHANNEL_NAME

# import myutils
. scripts/myutils.sh

createChannel() {
	setGlobals 0 1

	if [ -z "$CORE_PEER_TLS_ENABLED" -o "$CORE_PEER_TLS_ENABLED" = "false" ]; then
                set -x
		peer channel create -o orderer.example.com:7050 -c $CHANNEL_NAME -f ./channel-artifacts/channel.tx >&log.txt
		res=$?
                set +x
	else
				set -x
		peer channel create -o orderer.example.com:7050 -c $CHANNEL_NAME -f ./channel-artifacts/channel.tx --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA >&log.txt
		res=$?
				set +x
	fi
	cat log.txt
	verifyResult $res "Channel creation failed"
	echo "===================== Channel '$CHANNEL_NAME' created ===================== "
	echo
}

#Changed orgs to 1 2 3 in for loop
joinChannel () {
	for org in 1 2 3; do
	    for peer in 0 1; do
		joinChannelWithRetry $peer $org
		echo "===================== peer${peer}.org${org} joined channel '$CHANNEL_NAME' ===================== "
		sleep $DELAY
		echo
	    done
	done
}
#call this with one argument specifying the  # of orgs participating in this channel
joinMultiChannel () {
	for org in $(seq $1); do
	    for peer in 0 1; do
		joinChannelWithRetry $peer $org
		echo "===================== peer${peer}.org${org} joined channel '$CHANNEL_NAME' ===================== "
		sleep $DELAY
		echo
	    done
	done
}
## Create channel
echo "Creating channel..."
createChannel

## Join all the peers to the channel
echo "Having all peers join the channel..."
joinMultiChannel 6

## Set the anchor peers for each org in the channel
echo "Updating anchor peers for org1..."
updateAnchorPeers 0 1
echo "Updating anchor peers for org2..."
updateAnchorPeers 0 2
echo "Updating anchor peers for org3..."
updateAnchorPeers 0 3
echo "Updating anchor peers for org4..."
updateAnchorPeers 0 4
echo "Updating anchor peers for org5..."
updateAnchorPeers 0 5
echo "Updating anchor peers for org6..."
updateAnchorPeers 0 6

#Names of chaincodes to install
#NAME1=sctwo
NAME2=scthreediff6
## Install chaincode on peer0.org1 and peer0.org2
#echo "Installing chaincode ${NAME1} on peer0.org1..."
#installChaincode 0 1 "$NAME1" "$CC_SRC_PATH"
#echo "Install chaincode ${NAME1} on peer0.org2..."
#installChaincode 0 2 "$NAME1" "$CC_SRC_PATH"
#echo "Install chaincode ${NAME1} on peer0.org3..."
#installChaincode 0 3 "$NAME1" "$CC_SRC_PATH"
echo "Install chaincode ${NAME2} on peer0.org1..."
installChaincode 0 1 "$NAME2" "$CC_SRC_PATH2" 1.0
echo "Install chaincode ${NAME2} on peer0.org2..."
installChaincode 0 2 "$NAME2" "$CC_SRC_PATH2" 1.0
echo "Install chaincode ${NAME2} on peer0.org3..."
installChaincode 0 3 "$NAME2" "$CC_SRC_PATH2" 1.0
echo "Install chaincode ${NAME2} on peer0.org4..."
installChaincode 0 4 "$NAME2" "$CC_SRC_PATH2" 1.0
echo "Install chaincode ${NAME2} on peer0.org5..."
installChaincode 0 5 "$NAME2" "$CC_SRC_PATH2" 1.0
echo "Install chaincode ${NAME2} on peer0.org6..."
installChaincode 0 6 "$NAME2" "$CC_SRC_PATH2" 1.0


# Instantiate chaincode on peer0.org2
#echo "Instantiating chaincode on peer0.org2..."
#instantiateChaincode 0 2 "$NAME1"
echo "Instantiating chaincode on peer0.org2..."
instantiateChaincode 0 2 "$NAME2"

#sleep for some time to be sure that instantiation took place
#sleep 2

# Invoke chaincode on peer0.org1 and peer0.org2
#echo "Sending invoke transaction on peer0.org1,peer0.org2 and peer0.org3..."
#chaincodeInvoke "$NAME2" 0 1 0 2 
#chaincodeInvokeDeliverCrude "$NAME2" 0 1 0 2 


# Query chaincode on peer0.org1
#echo "Querying chaincode on peer0.org1..."
#chaincodeQuery 0 1 100 "$NAME1"


## Install chaincode on peer1.org2
#echo "Installing chaincode on peer1.org2..."
#installChaincode 1 2

# Query on chaincode on peer1.org2, check if the result is 90
#echo "Querying chaincode on peer1.org2..."
#chaincodeQuery 1 2 90

echo
echo "========= All GOOD, BYFN execution completed =========== "
echo

echo
echo " _____   _   _   ____   "
echo "| ____| | \ | | |  _ \  "
echo "|  _|   |  \| | | | | | "
echo "| |___  | |\  | | |_| | "
echo "|_____| |_| \_| |____/  "
echo

exit 0
