import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("SmartAccountFactory", function () {

  async function deployFactory() {
    // Contracts are deployed using the first signer/account by default
    const [owner] = await ethers.getSigners();
    const entryPoint = owner.address;

    const SimpleAccountFactory = await ethers.getContractFactory("SimpleAccountFactory");
    const factory = await SimpleAccountFactory.deploy(entryPoint);

    return { factory, entryPoint };
  }

  describe("Deploy smart account", function () {
    const salt = 123;
    it("Should get address", async function () {
      const { factory, entryPoint } = await loadFixture(deployFactory);
      console.log("🚀 ~ file: SmartAccountFactory.ts:26 ~ factory:", factory.target)
      const [_, otherAccount] = await ethers.getSigners();
      const address = await factory.computeAddress(otherAccount.address, salt);
      const create = await factory.createAccount(otherAccount.address, salt);
      await create.wait();
      const account = await ethers.getContractAt("SimpleAccount", address);
      console.log("🚀 ~ file: SmartAccountFactory.ts:31 ~ account:", await account.owner())
    });

  });

});
