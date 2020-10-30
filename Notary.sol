pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;

contract Notary {

    event FileNotarized(uint fileId, string fileName, uint time, address indexed owner, string hash);
    event FileChecked(uint fileId, string givenFileName, uint time, address indexed checker, string givenHash);

    struct NotarizedFile {
        uint id;
        address owner;
        string fileName;
        uint time;
        string hash;
    }

    NotarizedFile[] public files;
    mapping(address => NotarizedFile[]) public notarizedFiles;

    constructor()  {

    }

    function notarizeFile(string memory _fileName, string memory _hash) public {
        uint id = files.length;
        NotarizedFile memory file = NotarizedFile(id, msg.sender, _fileName, block.timestamp, _hash);
        files.push(file);
        notarizedFiles[msg.sender].push(file);

        emit FileNotarized(file.id, file.fileName, file.time, file.owner, file.hash);
    }


    function checkFile(uint _fileId, string memory _hash, string memory _fileName) public returns(bool) {
        emit FileChecked(_fileId, _fileName, block.timestamp, msg.sender, _hash);

        string memory fileHash = files[_fileId].hash;
        string memory fileName = files[_fileId].fileName;

        return keccak256(abi.encodePacked(fileHash)) == keccak256(abi.encodePacked(_hash)) &&
        keccak256(abi.encodePacked(fileName)) == keccak256(abi.encodePacked(_fileName));
    }

    function getFilesByAddress(address  _address) public view returns(NotarizedFile[] memory) {
        return notarizedFiles[_address];
    }

}