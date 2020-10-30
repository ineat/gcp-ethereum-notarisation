
// address of smart contract
const contractAddress = ""; // TODO contract address

// ABI of smart contract
const notaryABI = [{"inputs":[{"internalType":"uint256","name":"_fileId","type":"uint256"},{"internalType":"string","name":"_hash","type":"string"},{"internalType":"string","name":"_fileName","type":"string"}],"name":"checkFile","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"fileId","type":"uint256"},{"indexed":false,"internalType":"string","name":"givenFileName","type":"string"},{"indexed":false,"internalType":"uint256","name":"time","type":"uint256"},{"indexed":false,"internalType":"address","name":"checker","type":"address"},{"indexed":false,"internalType":"string","name":"givenHash","type":"string"}],"name":"FileChecked","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"fileId","type":"uint256"},{"indexed":false,"internalType":"string","name":"fileName","type":"string"},{"indexed":false,"internalType":"uint256","name":"time","type":"uint256"},{"indexed":false,"internalType":"address","name":"owner","type":"address"},{"indexed":false,"internalType":"string","name":"hash","type":"string"}],"name":"FileNotarized","type":"event"},{"inputs":[{"internalType":"string","name":"_fileName","type":"string"},{"internalType":"string","name":"_hash","type":"string"}],"name":"notarizeFile","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"files","outputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"address","name":"owner","type":"address"},{"internalType":"string","name":"fileName","type":"string"},{"internalType":"uint256","name":"time","type":"uint256"},{"internalType":"string","name":"hash","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_address","type":"address"}],"name":"getFilesByAddress","outputs":[{"components":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"address","name":"owner","type":"address"},{"internalType":"string","name":"fileName","type":"string"},{"internalType":"uint256","name":"time","type":"uint256"},{"internalType":"string","name":"hash","type":"string"}],"internalType":"struct Notary.NotarizedFile[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"notarizedFiles","outputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"address","name":"owner","type":"address"},{"internalType":"string","name":"fileName","type":"string"},{"internalType":"uint256","name":"time","type":"uint256"},{"internalType":"string","name":"hash","type":"string"}],"stateMutability":"view","type":"function"}]

// contract global object
var notaryContract;

/**
* Create a Web3 object to connect to blockchain
*/
async function initBlockchain() {
	// Modern dapp browsers...
	if (window.ethereum) {
		ethereum.autoRefreshOnNetworkChange = true;
		window.web3 = new Web3(ethereum);
		try {
			// Request account access if needed
			await ethereum.enable();
			console.log("Ethereum enabled with account : "+ethereum.selectedAddress);
		} catch (error) {
			console.error("Access denied for metamask by user");
		}

		ethereum.on("accountsChanged", (accounts) => { document.location.reload(true); });

	}
	// Legacy dapp browsers...
	else if (window.web3) {
		window.web3 = new Web3(web3.currentProvider);
	}
	// Non-dapp browsers...
	else {
		console.log('Non-Ethereum browser detected. You should consider trying MetaMask!');
	}

	console.log("web3 : "+web3.version);

	console.log("Load contract at : "+contractAddress);
	try {
		notaryContract =  new web3.eth.Contract(notaryABI, contractAddress);
	}
	catch(error) {
		console.error("Error loading contract : "+error);
	}
}

/**
* Retrieve and dispaly basic info from blockchain node
*/
async function displayBlockchainInfo() {
	$('#nodeInfo').text(await web3.eth.getNodeInfo());
	$('#blockNumber').text(await web3.eth.getBlockNumber());

	web3.eth.getAccounts()
	.then( async (accounts) => {

		let account = accounts[0];
		console.log("Account : "+account);
		$('#account').text(account);

		let balance = await web3.eth.getBalance(account);
		let balanceInEth = web3.utils.fromWei(balance);
		console.log("Balance : "+balanceInEth);
		$('#balance').text(balanceInEth);
	})
	.catch( (error) => {
		console.error("Error getting accounts : "+error);
	});

	$('#contractBalance').text(web3.utils.fromWei(await web3.eth.getBalance(contractAddress)));
}

/**
* Read and display notarized files from blockchain
*/
async function displayFiles(account) {
	console.log("Display files for "+account);

	notaryContract.methods.getFilesByAddress(account).call()
	.then( (files) => {
		let htmlFiles = "<table class='table'>";
		htmlFiles += "<tr><th>#</th><th>Name</th><th>Date</th><th>Check</th></tr>";
		files.forEach(function(item, index, array) {
			htmlFiles += "<tr><td>"+item.id+"</td><td>"+item.fileName+"</td><td>"+(new Date(item.time*1000)).toUTCString()+"</td><td>";
			htmlFiles += "<form method='post' action='javascript:callCheckFile("+item.id+")' enctype='multipart/form-data'><input type='file' name='fileToCheck' id='file"+item.id+"'><input type='hidden' name='id' value='"+item.id+"'><button type='submit' class='btn btn-primary'>Check</button></form>";
			htmlFiles +=" <div id='result"+item.id+"'></div></td></tr>";
		});
		htmlFiles += "</table>";

		$('#myFiles').html(htmlFiles);
	})
	.catch( (error) => {
	console.error("Error reading name : "+error);
	});
}


async function checkFile(account, id, fileName, fileHash) {
    console.log(account + " checks "+fileName+" : "+fileHash+".");

    var result =  await notaryContract.methods.checkFile(id, fileHash, fileName).call({from: account});
    console.log(result);
    if(result)
        $('#result'+id).html('<div class="alert alert-success">Untouched file!</div>');
     else
        $('#result'+id).html('<div class="alert alert-danger">Corrupted file!</div>');
}