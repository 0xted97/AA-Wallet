import {
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { fillAndSign, getAccountInitCode } from "../utils/user-op";
import { getPaymasterAndData, concatHash } from "../utils/verify-pasmaster";
import { TokenPaymaster } from "../../typechain-types";

describe("SmartAccountFactory", function () {

  async function deployContracts() {
    const initialPriceToken = 100000000 // USD per TOK
    const initialPriceEther = 500000000 // USD per ETH

    const {deployer, verifier } = await getEOAAccounts();

    const WETH9 = await ethers.getContractFactory("WETH9");
    const TokenERC20 = await ethers.getContractFactory("TokenERC20");
    const TokenNFT = await ethers.getContractFactory("TokenNFT");
    const MockOracle = await ethers.getContractFactory("MockOracle");
    const MockUniSwap = await ethers.getContractFactory("MockUniSwap");
    const DepositPaymaster = await ethers.getContractFactory("DepositPaymaster");
    const VerifyingPaymaster = await ethers.getContractFactory("VerifyingPaymaster");
    const TokenPaymaster = await ethers.getContractFactory("TokenPaymaster");
    const EntryPoint = await ethers.getContractFactory("EntryPoint");
    const SimpleAccountFactory = await ethers.getContractFactory("SimpleAccountFactory");
    const LockERC20 = await ethers.getContractFactory("LockERC20");


    const entryPoint = await EntryPoint.deploy();
    const weth9 = await WETH9.deploy();
    const tokenErc20 = await TokenERC20.deploy();
    const tokenNft = await TokenNFT.deploy();
    const tokenErc20Other = await TokenERC20.deploy();
    const mockTokenOracle = await MockOracle.deploy(initialPriceToken);
    const mockETHOracle = await MockOracle.deploy(initialPriceEther);
    const mockUniswap = await MockUniSwap.deploy(weth9.target.toString());
    const verifyingPaymaster = await VerifyingPaymaster.deploy(entryPoint.target, verifier.address);
    const depositPaymaster = await DepositPaymaster.deploy(entryPoint.target);


    const tokenPaymasterConfig: TokenPaymaster.TokenPaymasterConfigStruct = {
      priceMaxAge: 86400,
      refundPostopCost: 40000,
      minEntryPointBalance: 1e17.toString(),
      priceMarkup: 0 // +50%
    }
    const oracleHelperConfig = {
      cacheTimeToLive: 0,
      nativeOracle: mockETHOracle.target,
      nativeOracleReverse: false,
      priceUpdateThreshold: 200_000, // +20%
      tokenOracle: mockTokenOracle.target,
      tokenOracleReverse: false,
      tokenToNativeOracle: false
    }

    const uniswapHelperConfig = {
      minSwapAmount: 1,
      slippage: 5,
      uniswapPoolFee: 3
    }

    const tokenPaymaster = await TokenPaymaster.deploy(
      tokenErc20.target.toString(),
      entryPoint.target.toString(),
      weth9.target.toString(), // WETH9
      mockUniswap.target.toString(), // Uniswap example
      tokenPaymasterConfig,
      oracleHelperConfig,
      uniswapHelperConfig,
      deployer.address,
    );
    const factory = await SimpleAccountFactory.deploy(entryPoint.target);
    const lockErc20 = await LockERC20.deploy(tokenErc20.target);

    return { factory, tokenErc20, tokenNft, tokenErc20Other, lockErc20, mockTokenOracle, mockETHOracle, entryPoint, depositPaymaster, verifyingPaymaster, tokenPaymaster };
  }



  async function getEOAAccounts() {
    const [deployer, eoa1, eoa2, beneficiary, approve, bundler, verifier] = await ethers.getSigners();
    return { deployer, eoa1, eoa2, beneficiary, approve, bundler, verifier };
  }

  /**
   * Setup price feed and allow pay by token
   * Paymaster deposit ETH to pay gas fees
   */
  // beforeEach(async () => {
  //   const { tokenErc20, mockOracle, depositPaymaster } = await loadFixture(deployContracts);
  //   const addTokenTx = await depositPaymaster.addToken(tokenErc20.target, mockOracle.target);
  //   await addTokenTx.wait();

  //   const depositETHTx = await depositPaymaster.deposit({
  //     value: ethers.parseEther("100"),
  //   });
  //   await depositETHTx.wait();
  // });

  describe("Deploy smart account", function () {
    const salt = 112024;
    it("Should create account success", async function () {
      const { factory, entryPoint } = await loadFixture(deployContracts);
      const { eoa1 } = await getEOAAccounts();
      const address = await factory.computeAddress(eoa1.address, salt);
      const create = await factory.createAccount(eoa1.address, salt);
      await create.wait();
      const account = await ethers.getContractAt("SimpleAccount", address);
      const owner = await account.owner();
      const actualEntryPoint = await account.entryPoint();

      expect(owner).to.equal(eoa1.address);
      expect(actualEntryPoint).to.equal(entryPoint.target);
    });

    it("Should smart account can receive NFT", async function () {
      const { factory, tokenNft } = await loadFixture(deployContracts);
      const { eoa1 } = await getEOAAccounts();
      const address = await factory.computeAddress(eoa1.address, salt);
      const create = await factory.createAccount(eoa1.address, salt);
      await create.wait();

      // Mint NFT
      const mintTx = await tokenNft.mint(address, "uri");
      await mintTx.wait();

      expect(await tokenNft.balanceOf(address)).to.equal(1);
    });
  });

  describe("Should execute UserOperation (Without paymaster)", function () {
    const salt = 123123;
    it("Should pay be ETH", async function () {
      const { factory, entryPoint, tokenErc20, tokenNft, lockErc20 } = await loadFixture(deployContracts);
      const { eoa1, beneficiary, bundler } = await getEOAAccounts();

      const smartAccountAddress = await factory.computeAddress(eoa1.address, salt);
      const smartAccount = await ethers.getContractAt("SimpleAccount", smartAccountAddress);


      // Get init code
      const initCode = getAccountInitCode(eoa1.address, factory, salt);


      await tokenErc20.transfer(await smartAccount.getAddress(), ethers.parseEther("10000"));
      // Transfer fees to smart account
      await eoa1.sendTransaction({
        to: smartAccountAddress,
        value: ethers.parseEther("10"),
      });

      // Encode approve
      const approveData = tokenErc20.interface.encodeFunctionData("approve", [lockErc20.target, ethers.MaxUint256]);

      const approveCallData = smartAccount.interface.encodeFunctionData('execute', [tokenErc20.target, 0, approveData]);
      const approveOp = await fillAndSign({
        sender: smartAccountAddress,
        nonce: await entryPoint.getNonce(smartAccountAddress, 0),
        initCode,
        callData: approveCallData,
      }, eoa1, entryPoint);


      // Encode transfer
      const amountToTransfer = ethers.parseEther("1");
      const transferData = tokenErc20.interface.encodeFunctionData("transfer", [beneficiary.address, amountToTransfer]);
      const transferCallData = smartAccount.interface.encodeFunctionData('execute', [tokenErc20.target, 0, transferData]);

      const transferOp = await fillAndSign({
        sender: smartAccountAddress,
        nonce: await entryPoint.getNonce(smartAccountAddress, 1),
        initCode: "0x",
        callData: transferCallData,
      }, eoa1, entryPoint);


      // Encode lock token 20
      const amountToLock = ethers.parseEther("1.3");
      const lockTokenData = lockErc20.interface.encodeFunctionData("lockTokens", [amountToLock]);
      const lockTokenCallData = smartAccount.interface.encodeFunctionData('execute', [lockErc20.target, 0, lockTokenData]);

      const lockTokenOp = await fillAndSign({
        sender: smartAccountAddress,
        nonce: await entryPoint.getNonce(smartAccountAddress, 3),
        initCode: "0x",
        callData: lockTokenCallData,
      }, eoa1, entryPoint);

      // Mint to transfer
      const currentTokenId = await tokenNft.currentTokenId();
      const mintTx = await tokenNft.mint(smartAccountAddress, "uri");
      await mintTx.wait();

      // Transfer NFT to other
      const transferNftData = tokenNft.interface.encodeFunctionData("transferFrom", [smartAccountAddress, beneficiary.address, currentTokenId]);
      const transferNftCallData = smartAccount.interface.encodeFunctionData('execute', [tokenNft.target, 0, transferNftData]);

      const transferNftOp = await fillAndSign({
        sender: smartAccountAddress,
        nonce: await entryPoint.getNonce(smartAccountAddress, 4),
        initCode: "0x",
        callData: transferNftCallData,
      }, eoa1, entryPoint);

      // Send by "bundler"
      const handleOpsTx = await entryPoint.connect(bundler).handleOps([
        approveOp, transferOp, lockTokenOp, transferNftOp
      ], beneficiary.address);

      await handleOpsTx.wait();

      const allowance = await tokenErc20.allowance(smartAccount.target, lockErc20.target);
      const balanceOfBeneficiary = await tokenErc20.balanceOf(beneficiary.address);
      const balanceOfLockToken = await tokenErc20.balanceOf(lockErc20.target);
      const balanceNFTOfBeneficiary = await tokenNft.balanceOf(beneficiary.address);

      // Using test by event
      expect(allowance).to.equal(ethers.MaxUint256);
      expect(balanceOfBeneficiary).to.equal(amountToTransfer);
      expect(balanceOfLockToken).to.equal(amountToLock);
      expect(balanceNFTOfBeneficiary).to.equal(1);


    });
  });


  describe("Should execute UserOperation (Using paymaster)", function () {
    const salt = 123123123;
    it("Should user pay as ERC20", async function () {
      const { factory, entryPoint, depositPaymaster, tokenErc20, lockErc20, mockETHOracle } = await loadFixture(deployContracts);
      const { eoa1, beneficiary, bundler } = await getEOAAccounts();

      const smartAccountAddress = await factory.computeAddress(eoa1.address, salt);
      const smartAccount = await ethers.getContractAt("SimpleAccount", smartAccountAddress);


      // should in Before each
      await depositPaymaster.addToken(tokenErc20.target, mockETHOracle.target);
      await depositPaymaster.deposit({
        value: ethers.parseEther("100"),
      });
      await tokenErc20.transfer(smartAccountAddress, ethers.parseEther("1000"));


      // Get init code
      const initCode = getAccountInitCode(eoa1.address, factory, salt);

      // TODO: Upgrade Paymaster, it should sign message and verify signature in _validatePaymasterUserOp
      const paymasterAndData = (await depositPaymaster.getAddress()) + tokenErc20.target.toString().slice(2);
      // Encode approve
      const approvePaymasterData = tokenErc20.interface.encodeFunctionData("approve", [depositPaymaster.target, ethers.MaxUint256]);

      const approvePaymasterCallData = smartAccount.interface.encodeFunctionData('execute', [tokenErc20.target, ethers.ZeroAddress, approvePaymasterData]);
      const approvePaymasterOp = await fillAndSign({
        sender: smartAccountAddress,
        nonce: await entryPoint.getNonce(smartAccountAddress, 0),
        initCode,
        callData: approvePaymasterCallData,
        paymasterAndData,
      }, eoa1, entryPoint);

      // Approve Lock contract and lock token
      const approveLockContractData = tokenErc20.interface.encodeFunctionData("approve", [lockErc20.target, ethers.MaxUint256]);

      const approveLockContractCallData = smartAccount.interface.encodeFunctionData('execute', [tokenErc20.target, 0, approveLockContractData]);
      const approveLockContractOp = await fillAndSign({
        sender: smartAccountAddress,
        nonce: await entryPoint.getNonce(smartAccountAddress, 1),
        initCode: '0x',
        callData: approveLockContractCallData,
        paymasterAndData,
      }, eoa1, entryPoint);

      const amountToLock = ethers.parseEther("1.3");
      const lockTokenData = lockErc20.interface.encodeFunctionData("lockTokens", [amountToLock]);
      const lockTokenCallData = smartAccount.interface.encodeFunctionData('execute', [lockErc20.target, 0, lockTokenData]);

      const lockTokenOp = await fillAndSign({
        sender: smartAccountAddress,
        nonce: await entryPoint.getNonce(smartAccountAddress, 3),
        initCode: "0x",
        callData: lockTokenCallData,
        paymasterAndData,
      }, eoa1, entryPoint);

      // Send by "bundler"
      const handleOpsTx = await entryPoint.connect(bundler).handleOps([
        approvePaymasterOp, approveLockContractOp, lockTokenOp
      ], beneficiary.address);

      await handleOpsTx.wait();


      const allowance = await tokenErc20.allowance(smartAccountAddress, depositPaymaster.target);
      const balanceOfPaymaster = await tokenErc20.balanceOf(depositPaymaster.target);
      const balanceOfSmartAccount = await tokenErc20.balanceOf(smartAccountAddress);
      const balanceOfLockToken = await tokenErc20.balanceOf(lockErc20.target);

      expect(balanceOfLockToken).to.equal(amountToLock);
    });

    it("Should use VerifyingPaymaster pay fee for user, must verify by verifier", async function () {
      const { factory, entryPoint, verifyingPaymaster, tokenErc20, lockErc20 } = await loadFixture(deployContracts);
      const { eoa1, beneficiary, bundler, verifier } = await getEOAAccounts();

      const smartAccountAddress = await factory.computeAddress(eoa1.address, salt);
      const smartAccount = await ethers.getContractAt("SimpleAccount", smartAccountAddress);

      // Deposit ETH to pay fee
      await verifyingPaymaster.deposit({
        value: ethers.parseEther("100"),
      });
      // Transfer to smart account
      await tokenErc20.transfer(smartAccountAddress, ethers.parseEther("1000"));



      // Get init code
      const initCode = getAccountInitCode(eoa1.address, factory, salt);


      // Approve Lock contract and lock token
      const approveLockContractData = tokenErc20.interface.encodeFunctionData("approve", [lockErc20.target, ethers.MaxUint256]);

      const paymasterAndDataEmpty = concatHash(verifyingPaymaster);
      const approveLockContractCallData = smartAccount.interface.encodeFunctionData('execute', [tokenErc20.target, 0, approveLockContractData]);
      const approveLockContractOp = await fillAndSign({
        sender: smartAccountAddress,
        nonce: await entryPoint.getNonce(smartAccountAddress, 1),
        initCode,
        callData: approveLockContractCallData,
        paymasterAndData: paymasterAndDataEmpty
      }, eoa1, entryPoint);

      const approveLockContractWithPaymasterOp = await fillAndSign({
        ...approveLockContractOp,
        paymasterAndData: await getPaymasterAndData(approveLockContractOp, verifyingPaymaster, verifier),
      }, eoa1, entryPoint);

      const amountToLock = ethers.parseEther("1.3");
      const lockTokenData = lockErc20.interface.encodeFunctionData("lockTokens", [amountToLock]);
      const lockTokenCallData = smartAccount.interface.encodeFunctionData('execute', [lockErc20.target, 0, lockTokenData]);

      const lockTokenOp = await fillAndSign({
        sender: smartAccountAddress,
        nonce: await entryPoint.getNonce(smartAccountAddress, 2),
        initCode: "0x",
        callData: lockTokenCallData,
        paymasterAndData: paymasterAndDataEmpty,
      }, eoa1, entryPoint);

      const lockTokenWithPaymasterOp = await fillAndSign({
        ...lockTokenOp,
        paymasterAndData: await getPaymasterAndData(lockTokenOp, verifyingPaymaster, verifier),
      }, eoa1, entryPoint);

      // Send by "bundler"
      const handleOpsTx = await entryPoint.connect(bundler).handleOps([
        approveLockContractWithPaymasterOp, lockTokenWithPaymasterOp
      ], beneficiary.address);

      await handleOpsTx.wait();

      const balanceOfLockToken = await tokenErc20.balanceOf(lockErc20.target);

      expect(balanceOfLockToken).to.equal(amountToLock);
    });

    it("Should use TokenPaymaster, swap token <-> ETH to pay fee", async function () {
      const { factory, entryPoint, depositPaymaster, tokenErc20, lockErc20, mockOracle } = await loadFixture(deployContracts);
      const { eoa1, beneficiary, bundler } = await getEOAAccounts();

      const smartAccountAddress = await factory.computeAddress(eoa1.address, salt);
      const smartAccount = await ethers.getContractAt("SimpleAccount", smartAccountAddress);

    });
  });
});
