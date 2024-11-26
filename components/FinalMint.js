import React, { useEffect, useState } from "react";
import { decompressHexToSVG } from "../utils/compressAndHex";
import { BrowserProvider, Contract, ZeroAddress } from "ethers";
import { formatEther } from "ethers";
import { useTraits } from "../contexts/TraitContext";
import { contractAddress, abi } from "../utils/blockchain";

const phaseNames = ["Phase1", "Phase2", "Phase3"];

const FinalMint = () => {
  const { traits } = useTraits();
  const [svgPreviews, setSvgPreviews] = useState({});
  const [ethscriptionHashes, setEthscriptionHashes] = useState([]);
  const [minting, setMinting] = useState(false);
  const [creatingEthscriptions, setCreatingEthscriptions] = useState(false);
  const [contractStatus, setContractStatus] = useState({
    currentPhase: "Phase1",
    mintPrice: "0",
    paused: null,
  });
  const [walletConnected, setWalletConnected] = useState(false);

  // Connect MetaMask
  const connectMetaMask = async () => {
    if (!window.ethereum) {
      alert("MetaMask is not installed. Please install MetaMask and try again.");
      return;
    }
    try {
      const provider = new BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      setWalletConnected(true);
      console.log("MetaMask connected successfully.");
    } catch (error) {
      console.error("Error connecting to MetaMask:", error);
      alert("Failed to connect to MetaMask. Please try again.");
    }
  };

  // Fetch SVG previews for traits
  useEffect(() => {
    const fetchSVGs = async () => {
      const previews = {};
      for (const [traitName, hexValue] of Object.entries(traits)) {
        if (hexValue) {
          try {
            const svgContent = await decompressHexToSVG(hexValue);
            previews[traitName] = svgContent;
          } catch (error) {
            console.error(`Error decompressing SVG for trait ${traitName}:`, error);
          }
        }
      }
      setSvgPreviews(previews);
    };
    fetchSVGs();
  }, [traits]);

  // Fetch contract status
  const checkContractStatus = async () => {
    if (!contractAddress || !abi) {
        console.error("Contract address or ABI is missing.");
        alert("Error: Contract address or ABI is not defined. Please check your configuration.");
        return;
    }

    try {
        console.log("Fetching contract status...");
        const provider = new BrowserProvider(window.ethereum);
        const contract = new Contract(contractAddress, abi, provider);

        const currentPhase = await contract.currentPhase();
        const phaseDetails = await contract.phaseDetails(currentPhase);
        const paused = await contract.paused();

        const status = {
            currentPhase: phaseNames[parseInt(currentPhase)], // Convert currentPhase to human-readable phase name
            mintPrice: phaseDetails.mintPrice.toString(), // Raw mint price in wei
            paused,
        };

        console.log("Contract Status (raw):", status);

        // Convert mintPrice to ETH for display
        status.mintPriceDisplay = parseFloat(formatEther(status.mintPrice)); // Format wei to ETH
        console.log("Mint Price (formatted for display):", status.mintPriceDisplay);

        setContractStatus(status);
    } catch (error) {
        console.error("Error checking contract status:", error);
        alert("Failed to fetch contract status. Ensure the smart contract is deployed and accessible.");
    }
};

  useEffect(() => {
    checkContractStatus();
  }, []);

  // Store Ethscriptions
  const handleStoreEthscriptions = async () => {
    setCreatingEthscriptions(true);
    try {
      const hashes = [];
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      for (const [traitName, hexValue] of Object.entries(traits)) {
        if (!hexValue) continue;

        const tx = { to: ZeroAddress, value: 0n, data: `0x${hexValue}` };
        const txResponse = await signer.sendTransaction(tx);
        const txReceipt = await txResponse.wait();
        hashes.push(txReceipt.hash);
      }

      setEthscriptionHashes(hashes);
      console.log("Ethscriptions created:", hashes);
      alert("Ethscriptions stored successfully!");
    } catch (error) {
      console.error("Error storing Ethscriptions:", error);
      alert("Failed to store Ethscriptions. Please try again.");
    } finally {
      setCreatingEthscriptions(false);
    }
  };

  // Mint NFT
  const handleMintNFT = async () => {
    if (minting) return;
    setMinting(true);

    try {
        if (ethscriptionHashes.length !== 9) {
            alert("Please ensure all 9 Ethscriptions are stored before minting.");
            setMinting(false);
            return;
        }

        console.log("Minting process started...");

        if (!window.ethereum) {
            throw new Error("MetaMask is not available. Please install MetaMask and try again.");
        }

        const provider = new BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new Contract(contractAddress, abi, signer);

        if (!contract.mint) {
            throw new Error("Mint function not found in the smart contract. Verify the ABI and contract address.");
        }

        console.log("Contract connected. Preparing transaction...");
        console.log("Hashes to be minted:", ethscriptionHashes);

        // Use mintPrice directly from contractStatus
        const mintPriceWei = contractStatus.mintPrice;
        console.log("Mint Price (raw in wei):", mintPriceWei);

        console.log("Sending mint transaction...");
        const tx = await contract.mint(ethscriptionHashes, {
            value: mintPriceWei,
        });
        console.log("Transaction sent:", tx);

        console.log("Waiting for transaction confirmation...");
        await tx.wait();
        console.log("Transaction confirmed. NFT minted successfully!");

        alert("NFT minted successfully!");
    } catch (error) {
        console.error("Error during minting:", error);

        if (error.code === "CALL_EXCEPTION") {
            alert("Minting failed. Ensure the contract is deployed and the ABI matches.");
        } else {
            alert(`Minting failed: ${error.message}`);
        }
    } finally {
        setMinting(false);
    }
};

  return (
    <div style={{ textAlign: "center", padding: "20px" }}>
      <h2 style={{ color: "white" }}>Finalize & Mint</h2>
      {!walletConnected && (
        <button
          onClick={connectMetaMask}
          style={{
            padding: "10px 20px",
            backgroundColor: "blue",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            marginBottom: "20px",
          }}
        >
          Connect Wallet
        </button>
      )}
      <div>
        <p>Current Phase: {contractStatus.currentPhase}</p>
        <p>Mint Price: {contractStatus.mintPrice && `${parseFloat(contractStatus.mintPrice) / 1e18} ETH`}</p>
        <p>Contract Paused: {contractStatus.paused ? "Yes" : "No"}</p>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
        <div
          style={{
            textAlign: "left",
            width: "70%",
            border: "1px solid #ccc",
            padding: "10px",
            backgroundColor: "#f9f9f9",
            color: "#000",
          }}
        >
          <h3>Saved Traits:</h3>
          <ul>
            {Object.entries(traits).map(([traitName, hexValue]) => (
              <li key={traitName} style={{ marginBottom: "10px", overflow: "hidden", textOverflow: "ellipsis" }}>
                <strong>{traitName.charAt(0).toUpperCase() + traitName.slice(1)}:</strong>{" "}
                {hexValue || "No value"}
              </li>
            ))}
          </ul>
          <h3>Ethscription Hashes:</h3>
          <ul>
            {ethscriptionHashes.map((hash, index) => (
              <li key={index} style={{ color: "#000" }}>{hash}</li>
            ))}
          </ul>
        </div>

        <div
          style={{
            width: "382px",
            height: "382px",
            border: "1px solid #ccc",
            backgroundColor: "#f9f9f9",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {Object.values(svgPreviews).map((svgContent, index) => (
            <div
              key={index}
              dangerouslySetInnerHTML={{ __html: svgContent }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
              }}
            />
          ))}
        </div>
      </div>

      <button
        onClick={handleStoreEthscriptions}
        disabled={creatingEthscriptions || !walletConnected}
        style={{
          padding: "10px 20px",
          backgroundColor: creatingEthscriptions ? "gray" : walletConnected ? "orange" : "red",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: creatingEthscriptions ? "not-allowed" : walletConnected ? "pointer" : "not-allowed",
          marginRight: "10px",
        }}
      >
        {creatingEthscriptions ? "Storing..." : "Store Ethscriptions"}
      </button>

      <button
        onClick={handleMintNFT}
        disabled={minting || !walletConnected || ethscriptionHashes.length < 9}
        style={{
          padding: "10px 20px",
          backgroundColor: minting ? "gray" : walletConnected && ethscriptionHashes.length === 9 ? "forestgreen" : "red",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: minting ? "not-allowed" : walletConnected && ethscriptionHashes.length === 9 ? "pointer" : "not-allowed",
        }}
      >
        {minting ? "Minting..." : walletConnected ? "Mint NFT" : "Connect Wallet First"}
      </button>
    </div>
  );
};

export default FinalMint;
