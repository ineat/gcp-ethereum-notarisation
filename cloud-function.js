const util = require("util");
const Web3 = require("web3");
const EthereumTx = require('ethereumjs-tx').Transaction
const {Storage} = require('@google-cloud/storage');
const {SecretManagerServiceClient} = require('@google-cloud/secret-manager');

// The smart contract ABI
const notaryABI = [{"inputs":[{"internalType":"uint256","name":"_fileId","type":"uint256"},{"internalType":"string","name":"_hash","type":"string"},{"internalType":"string","name":"_fileName","type":"string"}],"name":"checkFile","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"fileId","type":"uint256"},{"indexed":false,"internalType":"string","name":"givenFileName","type":"string"},{"indexed":false,"internalType":"uint256","name":"time","type":"uint256"},{"indexed":false,"internalType":"address","name":"checker","type":"address"},{"indexed":false,"internalType":"string","name":"givenHash","type":"string"}],"name":"FileChecked","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"fileId","type":"uint256"},{"indexed":false,"internalType":"string","name":"fileName","type":"string"},{"indexed":false,"internalType":"uint256","name":"time","type":"uint256"},{"indexed":false,"internalType":"address","name":"owner","type":"address"},{"indexed":false,"internalType":"string","name":"hash","type":"string"}],"name":"FileNotarized","type":"event"},{"inputs":[{"internalType":"string","name":"_fileName","type":"string"},{"internalType":"string","name":"_hash","type":"string"}],"name":"notarizeFile","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"files","outputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"address","name":"owner","type":"address"},{"internalType":"string","name":"fileName","type":"string"},{"internalType":"uint256","name":"time","type":"uint256"},{"internalType":"string","name":"hash","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_address","type":"address"}],"name":"getFilesByAddress","outputs":[{"components":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"address","name":"owner","type":"address"},{"internalType":"string","name":"fileName","type":"string"},{"internalType":"uint256","name":"time","type":"uint256"},{"internalType":"string","name":"hash","type":"string"}],"internalType":"struct Notary.NotarizedFile[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"notarizedFiles","outputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"address","name":"owner","type":"address"},{"internalType":"string","name":"fileName","type":"string"},{"internalType":"uint256","name":"time","type":"uint256"},{"internalType":"string","name":"hash","type":"string"}],"stateMutability":"view","type":"function"}]

// Read Ethereum account and smart contract address form environment variables
const account = process.env.ACCOUNT;
const contractAddress = process.env.CONTRACT_ADDRESS;

var notaryContract = null;
var web3;

/**
* Retrieves a secret from GCP Secret Manager
*/
async function getSecret(secretName){
	const client = new SecretManagerServiceClient();
	const [accessResponse] = await client.accessSecretVersion({
		name: "projects/ /* TODO : project id in GCP */ /secrets/"+secretName+"/versions/latest"
	});
	const responsePayload = accessResponse.payload.data.toString('utf8');
	return responsePayload;
}

/**
* Connect to Ethereum using Infura and create contract object
*/
async function initBlockchain() {
	console.log("Connecting to blockchain");
	console.assert(account, "No account provided");
	console.assert(contractAddress, "No contract address provided");

	// get Infura secrets to build connection URI
	var infuraId = await getSecret("ethereum-notary-infura-id");
	var infuraSecret = await getSecret("ethereum-notary-infura-secret");
	var ethereumProvider = "https://:"+infuraSecret+"@ropsten.infura.io/v3/"+infuraId;

	// Connect to Infura
	var web3Provider = new Web3.providers.HttpProvider(ethereumProvider);
	web3 = new Web3(web3Provider);
	console.log("Use account "+account);
	console.log("Load contract at "+contractAddress);
	try {
		// Create contract object from ABI and contract address to interact with smart contract
		notaryContract =  new web3.eth.Contract(notaryABI, contractAddress);
	}
	catch(error) {
		console.error("Error loading contract : "+error);
	}
}

/**
* Send information to notarisation smart contract to write it in the blockchain
* @param account the account public key to use to create the transaction
* @param fileName the name of file to notarize
* @param fileHash the hash of file to notarize
*/
async function sendToBlockchain(account, fileName, fileHash) {

	// Get current transaction nonce for given account, mandatory to create signed transaction
	web3.eth.getTransactionCount(account, async function (err, nonce) {
		let gasPrice = await web3.eth.getGasPrice();

		// Build transaction body
		const txParams = {
			nonce: nonce,
			gasPrice: web3.utils.toHex(gasPrice),
			gasLimit: web3.utils.toHex('800000'),
			to: contractAddress,
			value: '0x00', // no Ether transfered
			// get smart contract 'notarizeFile' call with parameters, encoded to be wrapped in the transaction
			data: notaryContract.methods.notarizeFile(fileName, fileHash).encodeABI()
		}

		// Get private key
		const privateKey = await getSecret("ethereum-notary-private-key");
		const bufferedPrivateKey = Buffer.from(
		  privateKey,
		  'hex',
		)

		// Build and sign raw transaction
		const tx = new EthereumTx(txParams,{ chain: 'ropsten', hardfork: 'petersburg' });
		tx.sign(bufferedPrivateKey);
		const serializedTx = tx.serialize().toString('hex');

		var raw = '0x' + serializedTx;

		// Send transaction and deal with events
		web3.eth.sendSignedTransaction(raw)
		.once('sending', function(payload){ console.log("Send transaction"); })
		.once('sent', function(payload){  })
		.once('transactionHash', function(hash){ console.log("Tx hash: "+hash); })
		.once('receipt', function(receipt){  })
		.on('confirmation', function(confNumber, receipt, latestBlockHash){  })
		.on('error', function(error){ console.error(error); })
		.then(function(receipt){
		    console.log("Mined in block "+receipt.blockNumber);
		});
	});
}

/**
* Starts notarisation, this function is called when a file is uploaded in the Storage bucket
* @param event the event object sent when cloud function is triggered
* @param context the context object sent when cloud function is triggered
*/
exports.notarize = async function(event, context) {
	await initBlockchain();

	console.log("Read "+event.name+" from "+event.bucket);
	// Connect to bucket
	const storage = new Storage();
	const bucket = storage.bucket(event.bucket);
	const remoteFile = bucket.file(event.name);
	var content = "";
	// Read file from bucket
	remoteFile.createReadStream()
		.on("data", function(data) { content += data.toString(); })
		.on('error', function(err) { console.log(err); })
		.on('response', function(response) { })
		.on('end', function() {
			// When file is fully read, compute sha256 hash of content
			const hash = require("crypto").createHash('sha256').update(content).digest().toString("hex");
			console.log("File hash: "+hash);
			// Write data to blockchain
			sendToBlockchain(account, event.name, hash);
		});
}