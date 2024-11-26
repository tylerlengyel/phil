// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract Phil is ERC721Pausable, Ownable, IERC2981 {
    using Strings for uint256;

    uint256 private _nextTokenId;
    uint256 private _phaseMintedTokens;

    enum Phase { Phase1, Phase2, Phase3 }
    Phase public currentPhase;

    struct PhaseDetails {
        uint256 maxSupply;
        uint256 mintPrice;
    }

    mapping(Phase => PhaseDetails) public phaseDetails;
    mapping(uint256 => string[9]) private tokenEthscriptionHashes;

    uint256 private constant ROYALTY_PERCENTAGE = 10; // 10% royalty
    address private royaltyRecipient;

    event Minted(address indexed minter, uint256 tokenId, string[9] hashes);
    event PhaseChanged(Phase newPhase);

    constructor(address initialOwner) ERC721("Phil", "PHIL") Ownable(initialOwner) {
        royaltyRecipient = initialOwner;

        _nextTokenId = 0;
        _phaseMintedTokens = 0;

        // Define phase details
        phaseDetails[Phase.Phase1] = PhaseDetails({ maxSupply: 420, mintPrice: 0.42 ether });
        phaseDetails[Phase.Phase2] = PhaseDetails({ maxSupply: 369, mintPrice: 0.69 ether });
        phaseDetails[Phase.Phase3] = PhaseDetails({ maxSupply: 69, mintPrice: 1.69 ether });

        currentPhase = Phase.Phase1;

        emit PhaseChanged(currentPhase);
    }

    modifier isPhaseActive() {
        PhaseDetails memory currentDetails = phaseDetails[currentPhase];
        require(_phaseMintedTokens < currentDetails.maxSupply, "Phase mint limit reached");
        _;
    }

    function _updatePhase() internal {
        if (_phaseMintedTokens >= phaseDetails[currentPhase].maxSupply) {
            if (currentPhase == Phase.Phase1) {
                currentPhase = Phase.Phase2;
            } else if (currentPhase == Phase.Phase2) {
                currentPhase = Phase.Phase3;
            } else {
                return; // All phases completed
            }
            _phaseMintedTokens = 0;
            emit PhaseChanged(currentPhase);
        }
    }

    function mint(string[9] calldata _hashes) external payable isPhaseActive whenNotPaused {
        PhaseDetails memory currentDetails = phaseDetails[currentPhase];
        require(msg.value == currentDetails.mintPrice, "Incorrect ETH sent");

        uint256 tokenId = _nextTokenId++;
        _phaseMintedTokens++;

        for (uint256 i = 0; i < 9; i++) {
            tokenEthscriptionHashes[tokenId][i] = _hashes[i];
        }

        _safeMint(msg.sender, tokenId);

        emit Minted(msg.sender, tokenId, _hashes);

        _updatePhase();
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(ownerOf(tokenId) != address(0), "Token does not exist");

        string[9] memory hashes = tokenEthscriptionHashes[tokenId];
        string memory json = string(abi.encodePacked(
            '{"name": "Phil NFT #', tokenId.toString(), '",',
            '"description": "A unique Phil NFT with on-chain Ethscription hashes.",',
            '"attributes": [',
            '{"trait_type": "Hash1", "value": "', hashes[0], '"},',
            '{"trait_type": "Hash2", "value": "', hashes[1], '"},',
            '{"trait_type": "Hash3", "value": "', hashes[2], '"},',
            '{"trait_type": "Hash4", "value": "', hashes[3], '"},',
            '{"trait_type": "Hash5", "value": "', hashes[4], '"},',
            '{"trait_type": "Hash6", "value": "', hashes[5], '"},',
            '{"trait_type": "Hash7", "value": "', hashes[6], '"},',
            '{"trait_type": "Hash8", "value": "', hashes[7], '"},',
            '{"trait_type": "Hash9", "value": "', hashes[8], '"}',
            ']}'
        ));

        return string(abi.encodePacked("data:application/json;base64,", base64(bytes(json))));
    }

    function royaltyInfo(uint256, uint256 salePrice) external view override returns (address, uint256) {
        uint256 royaltyAmount = (salePrice * ROYALTY_PERCENTAGE) / 100;
        return (royaltyRecipient, royaltyAmount);
    }

    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    function base64(bytes memory data) internal pure returns (string memory) {
        string memory TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        bytes memory table = bytes(TABLE);
        bytes memory result = new bytes(4 * ((data.length + 2) / 3));

        for (uint256 i = 0; i < data.length; i += 3) {
            uint256 triple = uint256(uint8(data[i])) << 16;

            if (i + 1 < data.length) {
                triple |= uint256(uint8(data[i + 1])) << 8;
            }

            if (i + 2 < data.length) {
                triple |= uint256(uint8(data[i + 2]));
            }

            for (uint256 j = 0; j < 4; j++) {
                result[i / 3 * 4 + j] = table[(triple >> (18 - j * 6)) & 0x3F];
            }
        }

        uint256 paddingLength = (3 - (data.length % 3)) % 3;
        for (uint256 i = 0; i < paddingLength; i++) {
            result[result.length - 1 - i] = "=";
        }

        return string(result);
    }
}
