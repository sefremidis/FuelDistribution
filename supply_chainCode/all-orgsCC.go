/*
Gas & fuel supply chain management chaincode.


org1 -> driller
org2 -> shipper
org3 -> refiner
org4 -> distributor
org5/6 -> retailer / fuel stations



API:

deliverCrude
refine
addFuelOrder - coupled with a retailer.
deliverFuel - make a plan for distributing to different retailers. accumulate addFuelDelivery tx's.
transfer - either crude or fuel
query asset
query asset by range


*/
package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/hyperledger/fabric/core/chaincode/shim"
	sc "github.com/hyperledger/fabric/protos/peer"
	"strconv"
	"strings"
	"time"
)

type SmartContract struct {
}

/*
 */

type Vehicle struct {
	Type string
	ID   string
}
type DeliveryDetails struct {
	EstTime          time.Time
	Delay            float64
	StartingLocation string
	Destination      string
}
type TxProof struct {
	URL  string
	Hash string
}
type AssetDetails struct {
	Value    float64
	Quantity int
	Owner    string
	State    string
}

/*
Put in db with key CrudeID
Crude ID should be like this: CrudeXXXX where XXXX is an ever increasing number.
*/
type Crude struct {
	AD        AssetDetails
	DD        DeliveryDetails
	Proof     TxProof
	Veh       Vehicle
	Timestamp time.Time
}

/*
Put in db with key FuelID
Fuel ID should be like this: FuelXXXX where XXXX is an ever increasing number.
*/
type Fuel struct {
	AD        AssetDetails
	Density   float64 //quality
	Type      string
	CrudeID   string //like parent ID
	Timestamp time.Time
}

/*
Put in db with key FuelOrderID
FuelOrder ID should be like this: FuelOrderXXXX where XXXX is an ever increasing number.
*/
type FuelOrder struct {
	AD        AssetDetails
	Dest      string
	Proof     TxProof
	FuelID    string //like parent ID
	Timestamp time.Time
}

type FuelOrderID = string

/*
ID form : 'PlanXXXX'
A delivery plan from refinary towards the gas stations.
Contains the vehicle that will deliver the fuels at many fueling stations
A map for easy access to delivery details with key the orders that org2 has added.
*/
type FuelDeliveryPlan struct {
	Veh  Vehicle
	Plan map[FuelOrderID]DeliveryDetails
}

type OrgAmount struct {
	amount float64
	org    string
}

func (s *SmartContract) Init(APIstub shim.ChaincodeStubInterface) sc.Response {
	return shim.Success(nil)
}

/*
 * The Invoke method *
 called when an application requests to run any Smart Contract
 The app also specifies the specific smart contract function to call with args
*/
func (s *SmartContract) Invoke(APIstub shim.ChaincodeStubInterface) sc.Response {

	// Retrieve the requested Smart Contract function and arguments
	function, args := APIstub.GetFunctionAndParameters()
	// Route to the appropriate handler function to interact with the ledger
	if function == "deliverCrude" {
		return s.deliverCrude(APIstub, args)
	} else if function == "refine" {
		return s.refine(APIstub, args)
	} else if function == "addFuelOrder" {
		return s.addFuelOrder(APIstub, args)
	} else if function == "deliverFuel" {
		return s.deliverFuel(APIstub, args)
	} else if function == "transfer" {
		return s.transfer(APIstub, args)
	} else if function == "queryAsset" {
		return s.queryAsset(APIstub, args)
	} else if function == "queryAssetByRange" {
		return s.queryAssetByRange(APIstub, args)
	} else if function == "initLedger" {
		return s.initLedger(APIstub, args)
	}

	return shim.Error("Invalid Smart Contract function name.")
}

/*
args[0] = crudeID like 'CrudeXXXX'
arg1 = value,arg2 = quantity, arg3 = owner
arg4 = estTime, arg5 = startLoc, arg6 = dest
arg7 = vesselID , arg8 = timestamp
*/
func (s *SmartContract) deliverCrude(stub shim.ChaincodeStubInterface, args []string) sc.Response {
	//check if creator is org1-shipper??
	if len(args) != 9 {
		return shim.Error("Incorrect number of arguments. Expecting 9")
	}
	AD, err := NewAssetDetails(args[1], args[2], args[3], "ON_WAY")
	if err != nil {
		return shim.Error(err.Error())
	}
	DD, err := NewDeliveryDetails(args[4], args[5], args[6])
	if err != nil {
		return shim.Error(err.Error())
	}
	crudeAsBytes, _ := stub.GetState(args[0])
	if crudeAsBytes != nil {
		return shim.Error(fmt.Sprintf("Crude with id %s already exists", args[0]))
	}

	Proof := NewProof()
	//hardcoded vehID.TODO: construct base on the Hash(args[1]+args[2]...+)
	Veh := NewVehicle("Vessel", args[7])
	Timestamp, err := RFCtoTime(args[8])
	if err != nil {
		return shim.Error(err.Error())
	}
	crude := Crude{AD, DD, Proof, Veh, Timestamp}
	crudeAsBytes, _ = json.Marshal(crude)
	err = stub.PutState(args[0], crudeAsBytes) //if an crude with the same ID already exists, this will override it.
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to add crude: %s", args[0]))
	}

	return shim.Success(nil)
}

/*
Transform Crude oil into something useful (e.g. Fuel)
args[0] = fuelID like 'FuelXXXX'
arg1 = value,arg2 = quantity, arg3 = owner
arg4 = density,arg5 = type_of_fuel, arg6 = CrudeID (ancestor ID)
arg7 = timestamp.
*/
func (s *SmartContract) refine(stub shim.ChaincodeStubInterface, args []string) sc.Response {
	if len(args) != 8 {
		return shim.Error("Incorrect number of arguments. Expecting 8")
	}
	AD, err := NewAssetDetails(args[1], args[2], args[3], "REFINED")
	if err != nil {
		return shim.Error(err.Error())
	}
	Density, err := strconv.ParseFloat(args[4], 64)
	if err != nil {
		return shim.Error("Density should be a float number!")
	}
	Timestamp, err := RFCtoTime(args[7])
	if err != nil {
		return shim.Error(err.Error())
	}
	//ensure crudeID exists in db.
	crudebytes, _ := stub.GetState(args[6])
	if crudebytes == nil {
		return shim.Error("ID of crude doesn't exist!")
	}
	if fuelbytes, _ := stub.GetState(args[0]); fuelbytes != nil {
		return shim.Error("ID of fuel already exists.")
	}
	fuel := Fuel{AD, Density, args[5], args[6], Timestamp}
	fuelAsBytes, _ := json.Marshal(fuel)
	err = stub.PutState(args[0], fuelAsBytes)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to add fuel: %s", args[0]))
	}
	return shim.Success(nil)
}

/*
Refiner adds this when a fueling station asks for an order of fuel.
arg1-3 = asset_details
arg4 = dest, arg5 = fuelID
arg6 = timestamp
*/
func (s *SmartContract) addFuelOrder(stub shim.ChaincodeStubInterface, args []string) sc.Response {
	if len(args) != 7 {
		return shim.Error("Incorrect number of arguments. Expecting 7")
	}
	AD, err := NewAssetDetails(args[1], args[2], args[3], "READY_FOR_DISTRIBUTION")
	if err != nil {
		return shim.Error(err.Error())
	}
	if HasPrefixOrg(args[4]) == false {
		return shim.Error("Destination doesn't start with org!")
	}
	Proof := NewProof()
	//check that fuelID exists

	if fuelbytes, _ := stub.GetState(args[5]); fuelbytes == nil {
		return shim.Error("FuelID doens't exist!")
	}
	Timestamp, err := RFCtoTime(args[6])
	if err != nil {
		return shim.Error(err.Error())
	}
	//check that fuelOrderID doens't exist
	if fuelOrderbytes, _ := stub.GetState(args[1]); fuelOrderbytes != nil {
		return shim.Error("FuelOrderID already exists")
	}

	fuelOrder := FuelOrder{AD, args[4], Proof, args[5], Timestamp}
	fuelAsBytes, _ := json.Marshal(fuelOrder)
	err = stub.PutState(args[0], fuelAsBytes)
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to add fuelOrder: %s", args[0]))
	}
	return shim.Success(nil)

}

/*
Make a Fuel Delivery Plan based on existing FuelOrders. A track should deliver fuel to all fueling stations mentioned in the
Delivery Plan.
args of this invokation:
	PlanID
	TruckID
	{FuelOrderID,EstTime,Sloc,Dest}
	{FuelOrderID,EstTime,Sloc,Dest}
	.
	.
	.
	{FuelOrderID,EstTime,Sloc,Dest}
*/
func (s *SmartContract) deliverFuel(stub shim.ChaincodeStubInterface, args []string) sc.Response {
	//check that client supplied properly the # of args
	if len(args) < 2 {
		return shim.Error("Expecting more args")
	}
	Veh := NewVehicle("Truck", args[1])
	orders := args[2:]
	if len(orders) == 0 {
		return shim.Error("At least one delivery should be specified")
	} else if len(orders)%4 != 0 {
		return shim.Error(fmt.Sprintf("Arguments dont match!Pattern should be {FuelOrderID,EstTime,Sloc,Dest}... Instead args are %d", len(orders)))
	}
	Plan := make(map[FuelOrderID]DeliveryDetails)
	//orders[i] = FuelorderID , orders[i+1] = estTime , i+2 = sloc , i+3 = dest
	//change everys FuelOrder's state to ON_WAY and create a new DeliveryDetail for it.
	for i := 0; i < len(orders); i += 4 {
		var id FuelOrderID = orders[i]
		fuelOrderbytes, _ := stub.GetState(id)
		if fuelOrderbytes == nil {
			return shim.Error(fmt.Sprintf("FuelOrderID %s does not exist", id))
		}
		fuelOrder := FuelOrder{}
		json.Unmarshal(fuelOrderbytes, &fuelOrder)
		fuelOrder.AD.State = "ON_WAY"
		newFuelOrderbytes, _ := json.Marshal(fuelOrder)
		err := stub.PutState(id, newFuelOrderbytes)
		if err != nil {
			return shim.Error(fmt.Sprint("Failed to add %s with different state", id))

		}
		DD, err := NewDeliveryDetails(orders[i+1], orders[i+2], orders[i+3])
		if err != nil {
			return shim.Error(err.Error())
		}
		Plan[id] = DD
	}

	fuelDeliveryPlan := FuelDeliveryPlan{Veh, Plan}
	fuelDeliveryPlanAsBytes, _ := json.Marshal(fuelDeliveryPlan)
	err := stub.PutState(args[0], fuelDeliveryPlanAsBytes)
	if err != nil {
		return shim.Error(fmt.Sprint("Failed to add Plan %s in db", args[0]))

	}

	return shim.Success(nil)

}

/*
if we want to transfer FuelOrder then we should supply {FuelOrderID,owner,curtime,PlanID}
if we want to transfer Crude then we should supply {Crude,owner,curtime}

Transportation orgs get paid based on the quantity of fuel or crude oil they are delivering.

*/
func (s *SmartContract) transfer(stub shim.ChaincodeStubInterface, args []string) sc.Response {
	if len(args) != 4 && len(args) != 3 {
		return shim.Error("Wrong # of arguments.")
	}
	if ok := HasPrefixOrg(args[1]); ok == false {
		return shim.Error("Owner is not an org")
	}
	Timestamp, err := RFCtoTime(args[2])
	if err != nil {
		return shim.Error("Timestamp not in RFC3339 format.")
	}
	assetAsBytes, _ := stub.GetState(args[0])
	if assetAsBytes == nil {
		return shim.Error("Could not locate Asset")
	}
	switch id := args[0]; {
	case strings.HasPrefix(id, "Crude"):
		crude := Crude{}
		json.Unmarshal(assetAsBytes, &crude)

		logger := shim.NewLogger("myloger")

		fmt.Println("OK BEFORE dd transfer")
		logger.Critical("OK BEFORE dd transfer")
		timePenalty := crude.DD.transfer(Timestamp)
		fmt.Println("OK BEFORE ad transfer")
		logger.Critical("OK BEFORE ad transfer")
		err := crude.AD.transfer(args[1])
		fmt.Println("OK AFTER ad transfer")
		if err != nil {
			return shim.Error(err.Error())
		}

		//the new owner shall pay shipper based on the quantity he delivered
		//and driller based on the value of the crude oil.
		shipperPayment := float64(crude.AD.Quantity)/10.0 - timePenalty
		if shipperPayment < 0 {
			shipperPayment = 0
		}
		drillerPayment := crude.AD.Value
		payments := []OrgAmount{{shipperPayment, "org2"}, {drillerPayment, "org1"}}
		logger.Critical("OK BEFORE PAY")
		err = Pay(stub, crude.AD, payments)
		logger.Critical("OK AFTER PAY")
		if err != nil {
			return shim.Error(err.Error())
		}

		assetAsBytes, _ = json.Marshal(crude)
		err = stub.PutState(id, assetAsBytes)
		fmt.Println("OK AFTER pputstate")
		if err != nil {
			return shim.Error(fmt.Sprintf("Failed to put %s in db", id))
		}
	//change state of fuel and compute delay in deliveryPlan struct
	case strings.HasPrefix(id, "FuelOrder"):
		fuelOrder := FuelOrder{}
		json.Unmarshal(assetAsBytes, &fuelOrder)
		err := fuelOrder.AD.transfer(args[1])
		if err != nil {
			return shim.Error(err.Error())
		}
		if strings.HasPrefix(args[3], "Plan") == false {
			return shim.Error("PlanID is not of the form 'PlanXXX'")
		}
		dplanAsBytes, _ := stub.GetState(args[3])
		if dplanAsBytes == nil {
			return shim.Error("Could not locate Plan")
		}
		dplan := FuelDeliveryPlan{}
		json.Unmarshal(dplanAsBytes, &dplan)
		dd, ok := dplan.Plan[id]
		if ok == false {
			return shim.Error("FuelOrderID didn't exist in any plan")
		}

		timePenalty := dd.transfer(Timestamp)
		dplan.Plan[id] = dd
		dplanAsBytes, _ = json.Marshal(dplan)
		err = stub.PutState(args[3], dplanAsBytes)
		if err != nil {
			return shim.Error(fmt.Sprintf("Failed to put %s in db", args[3]))
		}

		//the new owner shall pay tracker based on the quantity he delivered
		//and refiner based on the value of the fuel order.
		trackPayment := float64(fuelOrder.AD.Quantity)/10.0 - timePenalty
		if trackPayment < 0 {
			trackPayment = 0
		}
		refinerPayment := fuelOrder.AD.Value
		payments := []OrgAmount{{trackPayment, "org4"}, {refinerPayment, "org3"}}
		err = Pay(stub, fuelOrder.AD, payments)
		if err != nil {
			return shim.Error(err.Error())
		}

		assetAsBytes, _ = json.Marshal(fuelOrder)
		err = stub.PutState(id, assetAsBytes)
		if err != nil {
			return shim.Error(fmt.Sprintf("Failed to put %s in db", id))
		}
	default:
		return shim.Error("Either this is not a valid ID or it's not deliverable")
	}
	return shim.Success(nil)
}

func (s *SmartContract) queryAsset(stub shim.ChaincodeStubInterface, args []string) sc.Response {
	if len(args) != 1 {
		return shim.Error("Incorect # of args")
	}
	assetAsBytes, _ := stub.GetState(args[0])
	if assetAsBytes == nil {
		return shim.Error("Could not locate asset")
	}
	return shim.Success(assetAsBytes)
}

func (s *SmartContract) queryAssetByRange(stub shim.ChaincodeStubInterface, args []string) sc.Response {
	var startKey, endKey string
	if len(args) != 1 {
		return shim.Error("Expecting 1 arg")
	}
	switch id := args[0]; id {
	case "Crude":
	case "Fuel":
	case "FuelOrder":
	case "Plan":
	default:
		return shim.Error("Arg should be one of {Crude,Fuel,FuelOrder,Plan}")
	}
	startKey = args[0] + "0"
	endKey = args[0] + "999"

	resultsIterator, err := stub.GetStateByRange(startKey, endKey)
	if err != nil {
		return shim.Error(err.Error())
	}
	defer resultsIterator.Close()

	var buffer bytes.Buffer
	buffer.WriteString("[")
	bArrayMemberAlreadyWritten := false
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return shim.Error(err.Error())
		}
		// Add comma before array members,suppress it for the first array member
		if bArrayMemberAlreadyWritten == true {
			buffer.WriteString(",")
		}
		buffer.WriteString("{\"Key\":")
		buffer.WriteString("\"")
		buffer.WriteString(queryResponse.Key)
		buffer.WriteString("\"")
		buffer.WriteString(", \"Record\":")
		// Record is a JSON object, so we write as-is
		buffer.WriteString(string(queryResponse.Value))
		buffer.WriteString("}")
		bArrayMemberAlreadyWritten = true
	}
	buffer.WriteString("]")
	fmt.Printf("- query:\n%s\n", buffer.String())
	return shim.Success(buffer.Bytes())
}

/*
Create accounts for each organization.
Form of accounts : key=org_name (e.g 'org1') and value=100000 (arbitrary starting amount)
An adversary can call initLedger multiple times in order to eliminate his debt,
so we make a check before proceeding into actions.
*/
func (s *SmartContract) initLedger(stub shim.ChaincodeStubInterface, args []string) sc.Response {
	if bytes, _ := stub.GetState("org1"); bytes != nil {
		return shim.Error("initLedger has been called already and should be called only once!")
	}
	jbytes, _ := json.Marshal(100000.0)
	err := stub.PutState("org1", jbytes)
	if err != nil {
		return shim.Error("Failed to create account for org1")
	}
	err = stub.PutState("org2", jbytes)
	if err != nil {
		return shim.Error("Failed to create account for org2")
	}
	err = stub.PutState("org3", jbytes)
	if err != nil {
		return shim.Error("Failed to create account for org3")
	}
	err = stub.PutState("org4", jbytes)
	if err != nil {
		return shim.Error("Failed to create account for org4")
	}
	err = stub.PutState("org5", jbytes)
	if err != nil {
		return shim.Error("Failed to create account for org5")
	}
	err = stub.PutState("org6", jbytes)
	if err != nil {
		return shim.Error("Failed to create account for org6")
	}
	return shim.Success(nil)
}

func HasPrefixOrg(s string) bool {
	return strings.HasPrefix(s, "org")
}

func (ad *AssetDetails) transfer(own string) error {
	if ad.State != "ON_WAY" {
		return errors.New("Cannot transfer asset if it's state is not ON_WAY")
	}
	ad.State = "DELIVERED"
	ad.Owner = own
	return nil
}

func (dd *DeliveryDetails) transfer(tstamp time.Time) float64 {
	dd.Delay = tstamp.Sub(dd.EstTime).Seconds()
	timePenalty := dd.Delay / 100.0
	if timePenalty < 0 {
		return 0
	}
	return timePenalty
}

//construct a new AssetDetails type based on supplied args
func NewAssetDetails(val, quant, own, st string) (AssetDetails, error) {
	//value can be zero if shipper doesn't want to make it public.
	value, err := strconv.ParseFloat(val, 64)
	if err != nil || value < 0 {
		return AssetDetails{}, errors.New("Value is not a float number")
	}
	quantity, err := strconv.ParseInt(quant, 10, 64)
	if err != nil || quantity < 0 {
		return AssetDetails{}, errors.New("Quantity is not an int number")
	}
	if HasPrefixOrg(own) == false {
		return AssetDetails{}, errors.New("Owner value is not prefixed with string 'org'")
	}
	return AssetDetails{value, int(quantity), own, st}, nil
}

//construct a new DeliveryDetails type based on supplied args
func NewDeliveryDetails(est, sloc, dest string) (DeliveryDetails, error) {

	estTime, err := time.Parse(time.RFC3339, est)
	if err != nil {
		return DeliveryDetails{}, errors.New("Time is not in RFC3339 format")
	}
	if HasPrefixOrg(sloc) == false {
		return DeliveryDetails{}, errors.New("Starting Location value is not prefixed with 'org'")
	}
	if HasPrefixOrg(dest) == false {
		return DeliveryDetails{}, errors.New("Destination value is not prefixed with 'org'")
	}
	return DeliveryDetails{estTime, 0, sloc, dest}, nil
}

/*
OrgAmount slice contains which orgs the current owner should pay from the asset delivery
and how much (the amount).Amounts should be always non negative.
oa[0].org = organization who delivers (e.g. shipper)
oa[1].org = organization who supplies (e.g. refiner or driller)
*/
func Pay(stub shim.ChaincodeStubInterface, ad AssetDetails, oa []OrgAmount) error {
	//get the current account amounts
	orgBuyAccBytes, err := stub.GetState(ad.Owner)
	if err != nil {
		return errors.New("Please call initLedger before transfer")
	}
	orgSell1AccBytes, err := stub.GetState(oa[0].org)
	if err != nil {
		return errors.New("Please call initLedger before transfer")
	}
	orgSell2AccBytes, err := stub.GetState(oa[1].org)
	if err != nil {
		return errors.New("Please call initLedger before transfer")
	}
	if oa[0].amount < 0 || oa[1].amount < 0 {
		return errors.New("Amounts to be paid should be positive")
	}
	var orgBuyAmount, orgSell1Amount, orgSell2Amount float64
	json.Unmarshal(orgBuyAccBytes, &orgBuyAmount)
	json.Unmarshal(orgSell1AccBytes, &orgSell1Amount)
	json.Unmarshal(orgSell2AccBytes, &orgSell2Amount)
	//update the accounts
	orgBuyAmount -= oa[0].amount + oa[1].amount //buyer should pay both the dristributor and supplier
	orgSell1Amount += oa[0].amount              //distributor gets paid by buyer
	orgSell2Amount += oa[1].amount              //supplier gets paid by buyer
	orgBuyAccBytes, err = json.Marshal(orgBuyAmount)
	orgSell1AccBytes, err = json.Marshal(orgSell1Amount)
	orgSell2AccBytes, err = json.Marshal(orgSell2Amount)
	err = stub.PutState(ad.Owner, orgBuyAccBytes)
	if err != nil {
		errors.New(fmt.Sprintf("Failed to add new amount for %s org", ad.Owner))
	}
	err = stub.PutState(oa[0].org, orgSell1AccBytes)
	if err != nil {
		errors.New(fmt.Sprintf("Failed to add new amount for %s org", oa[0].org))
	}
	err = stub.PutState(oa[1].org, orgSell2AccBytes)
	if err != nil {
		errors.New(fmt.Sprintf("Failed to add new amount for %s org", oa[1].org))
	}
	return nil
}

/*
A dummy proof constructor.
Hash is the SHA256("ait")
*/
func NewProof() TxProof {
	return TxProof{"www.ait.gr", "7cb0d761a60f4968299cda86c333dafe318fbf87b0979f60befd0499e39e21d6"}
}
func NewVehicle(typ, id string) Vehicle {
	return Vehicle{typ, id}
}
func RFCtoTime(rfc string) (time.Time, error) {
	currtime, err := time.Parse(time.RFC3339, rfc)
	if err != nil {
		return time.Time{}, errors.New("Time not provided in RFC3339 format.")
	}
	return currtime, nil
}

func main() {

	// Create a new Smart Contract
	err := shim.Start(new(SmartContract))
	if err != nil {
		fmt.Printf("Error creating new Smart Contract: %s", err)
	}
}
